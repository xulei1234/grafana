import { useEffect, useRef } from 'react';
import { Params, useParams } from 'react-router-dom-v5-compat';
import { usePrevious } from 'react-use';

import { PageLayoutType } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { UrlSyncContextProvider } from '@grafana/scenes';
import { Box } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { isKioskEnabled, useCustomKiosk } from 'app/core/navigation/customKiosk';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import {
  DashboardBrandingFooter,
  DashboardBrandingFooterVariant,
} from 'app/features/dashboard/components/PublicDashboard/DashboardBrandingFooter';
import { DashboardPageError } from 'app/features/dashboard/containers/DashboardPageError';
import { DashboardPageRouteParams, DashboardPageRouteSearchParams } from 'app/features/dashboard/containers/types';
import { getDashboardSceneProfiler } from 'app/features/dashboard/services/DashboardProfiler';
import { DashboardPreviewBanner } from 'app/features/provisioning/components/Dashboards/DashboardPreviewBanner';
import { DashboardRoutes } from 'app/types/dashboard';

import { DashboardConversionWarningBanner } from '../components/DashboardConversionWarningBanner';
import { DashboardPrompt } from '../saving/DashboardPrompt';
import { preserveDashboardSceneStateInLocalStorage } from '../utils/dashboardSessionState';

import { getDashboardScenePageStateManager } from './DashboardScenePageStateManager';
import { shouldHideDashboardKioskFooter } from './utils';

export interface Props
  extends Omit<GrafanaRouteComponentProps<DashboardPageRouteParams, DashboardPageRouteSearchParams>, 'match'> {}

export function DashboardScenePage({ route, queryParams, location }: Props) {
  const params = useParams();
  const { type, slug, uid } = params;
  // Used by /dashboard/provisioning/:slug/preview/* to load dashboards based on their file path in a remote repository
  // Also used by /dashboard/assistant-preview/* to load the assistant preview dashboard
  const path = params['*'];
  const prevMatch = usePrevious({ params });
  const stateManager = getDashboardScenePageStateManager();
  const { dashboard, isLoading, loadError } = stateManager.useState();
  // After scene migration is complete and we get rid of old dashboard we should refactor dashboardWatcher so this route reload is not need
  const routeReloadCounter = (location.state as any)?.routeReloadCounter;
  const prevParams = useRef<Params<string>>(params);
  const { resolved } = useCustomKiosk();

  // Bridge useCustomKiosk resolved state into DashboardControls scene state.
  //
  // ⚠️ INTENTIONAL DESIGN — additive-only (URL param can hide but not un-hide controls):
  //
  // This mirrors the behaviour of the native `_dash.hideTimePicker` / `_dash.hideVariables`
  // URL params already handled by DashboardControls.updateFromUrl(), which also only ever
  // sets flags to true and never reverts them.  The rationale is identical:
  //
  //   • These params are meant for embedding / kiosk entry-point URLs. The expectation is
  //     that the user stays in that context for the lifetime of the page.
  //   • Reverting on URL change would require DashboardControls to track "which flags came
  //     from URL vs from the dashboard model", adding bidirectional complexity.
  //   • If the embedding URL changes to remove a param (e.g. back-navigation), the dashboard
  //     will normally re-mount (routeReloadCounter or uid change) and start fresh.
  //
  // Do NOT change this to a two-way sync without also updating DashboardControls.updateFromUrl()
  // and the native _dash.* handling — both must stay consistent.
  useEffect(() => {
    const controls = dashboard?.state.controls;
    if (!controls) {
      return;
    }
    const updates: Record<string, boolean> = {};
    if (!controls.state.hideTimeControls && resolved.hideTime) {
      updates.hideTimeControls = true;
    }
    if (!controls.state.hideRefreshControls && resolved.hideRefresh) {
      updates.hideRefreshControls = true;
    }
    if (!controls.state.hideVariableControls && resolved.hideVariables) {
      updates.hideVariableControls = true;
    }
    if (!controls.state.hideLinksControls && resolved.hideLinks) {
      updates.hideLinksControls = true;
    }
    if (Object.keys(updates).length > 0) {
      controls.setState(updates);
    }
  }, [dashboard, resolved.hideTime, resolved.hideRefresh, resolved.hideVariables, resolved.hideLinks]);

  useEffect(() => {
    if (route.routeName === DashboardRoutes.Normal && type === 'snapshot') {
      stateManager.loadSnapshot(slug!);
    } else {
      stateManager.loadDashboard({
        uid:
          (route.routeName === DashboardRoutes.Provisioning || route.routeName === DashboardRoutes.AssistantPreview
            ? path
            : uid) ?? '',
        type,
        slug,
        route: route.routeName as DashboardRoutes,
        urlFolderUid: queryParams.folderUid,
      });
    }

    return () => {
      getDashboardSceneProfiler().cancelProfile();
      preserveDashboardSceneStateInLocalStorage(locationService.getSearch(), uid);
      stateManager.clearState();
      stateManager.resetActiveManager();
    };

    // removing slug and path (which has slug in it) from dependencies to prevent unmount when data links reference
    //  the same dashboard with no slug in url
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateManager, uid, route.routeName, queryParams.folderUid, routeReloadCounter, type]);

  useEffect(() => {
    // This use effect corrects URL without refresh when navigating to the same dashboard
    //  using data link that has no slug in url
    if (route.routeName === DashboardRoutes.Normal) {
      // correct URL only when there are no new slug
      // if slug is defined and incorrect it will be corrected in stateManager
      if (uid === prevParams.current.uid && prevParams.current.slug && !slug) {
        const correctedUrl = `/d/${uid}/${prevParams.current.slug}`;
        locationService.replace({
          ...locationService.getLocation(),
          pathname: correctedUrl,
        });
      }
    }

    return () => {
      prevParams.current = { uid, slug: !slug ? prevParams.current.slug : slug };
    };
  }, [route, slug, type, uid]);

  if (!dashboard) {
    let errorElement;
    if (loadError) {
      errorElement = <DashboardPageError error={loadError} type={type} />;
    }

    return (
      errorElement || (
        <Page navId="dashboards/browse" layout={PageLayoutType.Canvas} data-testid={'dashboard-scene-page'}>
          <Box paddingY={4} display="flex" direction="column" alignItems="center">
            {isLoading && <PageLoader />}
          </Box>
        </Page>
      )
    );
  }

  // Do not render anything when transitioning from one dashboard to another
  // A bit tricky for transition to or from Home dashboard that does not have a uid in the url (but could have it in the dashboard model)
  // if prevMatch is undefined we are going from normal route to home route or vice versa
  if (type !== 'snapshot' && (!prevMatch || uid !== prevMatch?.params.uid)) {
    console.log('skipping rendering');
    return null;
  }

  // `locationSearchToObject()` parses `?kiosk` (no-value) as boolean true. `?kiosk=` (empty value)
  // is intentionally NOT treated as kiosk — only `?kiosk` and `?kiosk=1` activate kiosk mode.
  const isKioskMode = isKioskEnabled(queryParams.kiosk) || resolved.hideChrome;
  const hideFooter = shouldHideDashboardKioskFooter(queryParams.hideLogo) || resolved.hideKioskFooter;

  return (
    <UrlSyncContextProvider scene={dashboard} updateUrlOnInit={true} createBrowserHistorySteps={true}>
      <DashboardPreviewBanner queryParams={queryParams} route={route.routeName} slug={slug} path={path} />
      <DashboardConversionWarningBanner dashboard={dashboard} />
      <dashboard.Component model={dashboard} key={dashboard.state.key} />
      <DashboardPrompt dashboard={dashboard} />
      <DashboardBrandingFooter
        variant={DashboardBrandingFooterVariant.Kiosk}
        paddingX={2}
        useMinHeight={true}
        hide={!isKioskMode || hideFooter}
      />
    </UrlSyncContextProvider>
  );
}

export default DashboardScenePage;
