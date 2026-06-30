import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { setPluginImportUtils, config } from '@grafana/runtime';
import { SceneGridLayout, SceneTimeRange, SceneVariableSet, VizPanel } from '@grafana/scenes';

import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DashboardScene } from '../scene/DashboardScene';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { DashboardEditPaneSplitter } from './DashboardEditPaneSplitter';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

const autoLayoutInputs = [
  selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.minColumnWidth,
  selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.maxColumns,
  selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.rowHeight,
  selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.fillScreen,
];

describe('DashboardEditPaneSplitter', () => {
  beforeEach(() => {
    config.featureToggles.dashboardNewLayouts = true;
  });

  describe('noPadding prop', () => {
    it('applies an extra CSS class to bodyWrapper and scrollContainer when noPadding=true (NewLayouts normal path)', () => {
      const scene = buildTestScene();
      const { rerender } = render(<DashboardEditPaneSplitter dashboard={scene} noPadding={false} />);

      const primaryBody = screen.getByTestId(selectors.components.DashboardEditPaneSplitter.primaryBody);
      const bodyContainer = screen.getByTestId(selectors.components.DashboardEditPaneSplitter.bodyContainer);

      const primaryBodyClassWithout = primaryBody.className;
      const bodyContainerClassWithout = bodyContainer.className;

      rerender(<DashboardEditPaneSplitter dashboard={scene} noPadding={true} />);

      // noPadding=true must add an extra Emotion class; className must differ
      expect(primaryBody.className).not.toBe(primaryBodyClassWithout);
      expect(bodyContainer.className).not.toBe(bodyContainerClassWithout);
    });

    it('applies an extra CSS class to canvas wrapper when noPadding=true (Legacy path)', () => {
      config.featureToggles.dashboardNewLayouts = false;
      const scene = buildTestScene();
      const { rerender, container } = render(<DashboardEditPaneSplitter dashboard={scene} noPadding={false} />);

      // In legacy mode the outermost scrollable div is the first child of NativeScrollbar
      const canvasWrapper = container.querySelector('[data-scrollbar-content="true"] > div') as HTMLElement | null;
      const classWithout = canvasWrapper?.className ?? '';

      rerender(<DashboardEditPaneSplitter dashboard={scene} noPadding={true} />);

      expect(canvasWrapper?.className).not.toBe(classWithout);
    });
  });

  it('should switch between custom and auto layout', async () => {
    const user = userEvent.setup();
    const scene = buildTestScene();

    render(<DashboardEditPaneSplitter dashboard={scene} />);

    await user.click(screen.getByTestId(selectors.pages.Dashboard.Sidebar.optionsButton));

    // switch to auto and confirm change
    await user.click(screen.getByLabelText('layout-selection-option-Auto'));
    let confirmButton = screen.getByTestId(selectors.pages.ConfirmModal.delete);
    await user.click(confirmButton);

    // check auto layout inputs are visible
    autoLayoutInputs.forEach((testId) => {
      expect(screen.queryByTestId(testId)).toBeInTheDocument();
    });
    expect(scene.state.body).toBeInstanceOf(AutoGridLayoutManager);

    // switch back to custom and confirm change
    await user.click(screen.getByLabelText('layout-selection-option-Custom'));
    confirmButton = screen.getByTestId(selectors.pages.ConfirmModal.delete);
    await user.click(confirmButton);

    // check that auto layout inputs are not visible in custom
    autoLayoutInputs.forEach((testId) => {
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    });
  });
});

export function buildTestScene() {
  const testScene = new DashboardScene({
    $variables: new SceneVariableSet({ variables: [] }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    $data: new DashboardDataLayerSet({ annotationLayers: [] }),
    isEditing: true,
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [new DashboardGridItem({ body: new VizPanel({ key: 'panel-1', pluginId: 'text' }) })],
      }),
    }),
  });
  return testScene;
}
