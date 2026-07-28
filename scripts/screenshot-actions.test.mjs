import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';

import {
  ActionExecutionError,
  executeCheckAction,
  executeClickAction,
  executeFillAction,
  executeScreenshotActions,
  executeSelectAction,
  executeWaitForAction,
  resolveActionValue,
} from './screenshot-actions.mjs';
import { createDefaultConfig } from './screenshot-config.mjs';

const discoveryContext = {
  party: 'Alice::party',
  template: 'pkg:Module:Template',
  nodeId: 'node-a',
  nodes: [{ id: 'node-a', label: 'Node A' }, { id: 'node-b', label: 'Node B' }],
  trafficNodeIds: ['node-a', 'node-b'],
  publicKey: 'namespace-key',
  tokenName: 'Amulet',
  issuer: 'issuer::party',
  updateId: 'update-1',
};

const errorMetadata = { route: 'updates', state: 'filters', panel: 'target-panel' };

function panelMarkup(id, controls, fields) {
  return `
    <section id="${id}" role="region" aria-label="${id}" aria-expanded="true">
      ${fields}
      <label for="${id}-movement">Movement Type</label>
      <select id="${id}-movement"><option value="Transfer">Transfer</option><option value="Mint">Mint</option></select>
      <button type="button" data-panel="${id}" data-action="add">Add party filter</button>
      <button type="button" data-panel="${id}" data-action="add">Add template filter</button>
      <button type="button" data-panel="${id}" data-action="add">Add name filter</button>
      <button type="button" data-panel="${id}" data-action="add">Add issuer filter</button>
      <button type="button" data-panel="${id}" data-action="add">Add from party filter</button>
      <button type="button" data-panel="${id}" data-action="add">Add to party filter</button>
      <button type="button" data-panel="${id}" data-action="add">Add movement type filter</button>
      <button type="button" data-panel="${id}" data-action="search">Search Namespaces</button>
      <button type="button" data-panel="${id}" data-action="apply">Apply filters</button>
    </section>
    <button type="button" aria-controls="${controls}" data-action="open">Advanced Filter</button>
  `;
}

function allActionsFixture() {
  const fields = `
    <input placeholder="Party ID">
    <input placeholder="Template ID">
    <input placeholder="Name">
    <input placeholder="Issuer">
    <input placeholder="From Party ID">
    <input placeholder="To Party ID">
  `;
  const trafficFields = `
    <label><input type="checkbox" aria-label="Node A"> Node A</label>
    <label><input type="checkbox" aria-label="Node B"> Node B</label>
    <label>Minimum date <input></label>
    <label>Maximum date <input></label>
    <label>Minimum purchased traffic <input></label>
    <label>Minimum paid amount <input></label>
  `;
  return `<!doctype html>
    <html><body>
      <button type="button" data-action="open">Namespaces</button>
      <button type="button" aria-controls="wrong-panel" data-action="open">Advanced Filter</button>
      ${panelMarkup('home-updates-advanced-filter', 'home-updates-advanced-filter', fields)}
      ${panelMarkup('contracts-advanced-filter', 'contracts-advanced-filter', fields)}
      ${panelMarkup('party-updates-advanced-filter', 'party-updates-advanced-filter', fields)}
      ${panelMarkup('party-contracts-advanced-filter', 'party-contracts-advanced-filter', fields)}
      ${panelMarkup('tokens-advanced-filter', 'tokens-advanced-filter', fields)}
      ${panelMarkup('token-transfers-advanced-filter', 'token-transfers-advanced-filter', fields)}
      <section id="namespace-advanced-filter" role="region" aria-label="namespace-advanced-filter" aria-expanded="true">
        <label>Public Key <input></label>
        <button type="button" data-panel="namespace-advanced-filter">Search Namespaces</button>
      </section>
      <button type="button" aria-controls="namespace-advanced-filter" data-action="open">Advanced Filter</button>
      <section id="traffic-purchases-advanced-search" role="region" aria-label="traffic-purchases-advanced-search" aria-expanded="true">
        ${trafficFields}
        <button type="button" data-panel="traffic-purchases-advanced-search">Apply filters</button>
      </section>
      <button type="button" aria-controls="traffic-purchases-advanced-search" data-action="open">Advanced Search</button>
      <script>
        window.events = [];
        for (const element of document.querySelectorAll('button')) {
          element.addEventListener('click', () => window.events.push({
            text: element.textContent.trim(),
            panel: element.dataset.panel || null,
          }));
        }
      </script>
    </body></html>`;
}

async function newPage() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(`<!doctype html>
    <main>
      <button type="button" aria-controls="wrong-panel">Advanced Filter</button>
      <button type="button" aria-controls="target-panel">Advanced Filter</button>
      <section id="wrong-panel" role="region" aria-label="Wrong filters" aria-expanded="false" data-opened="false"></section>
      <section id="target-panel" role="region" aria-label="Target filters" aria-expanded="true">
        <label for="party">Party</label>
        <input id="party" placeholder="Party ID">
        <label for="movement">Movement Type</label>
        <select id="movement"><option value="Transfer">Transfer</option><option value="Mint">Mint</option></select>
        <label><input id="node-a" type="checkbox"> Node A</label>
        <input id="selector-input">
        <button type="button" id="target-add">Add party filter</button>
      </section>
      <section id="other-panel" role="region" aria-label="Other filters" aria-expanded="true">
        <label for="other-party">Party</label>
        <input id="other-party" placeholder="Party ID">
      </section>
      <section id="expanded-landmark" role="region" aria-label="Expanded landmark" aria-expanded="true">
        <label for="public-key">Public Key</label>
        <input id="public-key">
      </section>
      <button type="button" id="ambiguous">Apply filters</button>
      <button type="button" id="ambiguous-2">Apply filters</button>
      <script>
        window.events = [];
        for (const element of document.querySelectorAll('button')) {
          const controls = element.getAttribute('aria-controls');
          if (controls) {
            element.addEventListener('click', () => {
              for (const panel of document.querySelectorAll('section[data-opened]')) {
                panel.setAttribute('aria-expanded', 'false');
                panel.dataset.opened = 'false';
              }
              const panel = document.getElementById(controls);
              if (panel) {
                panel.setAttribute('aria-expanded', 'true');
                panel.dataset.opened = 'true';
              }
            });
          }
          element.addEventListener('click', () => window.events.push({
            text: element.textContent.trim(),
            panel: element.dataset.panel || null,
          }));
        }
      </script>
    </main>`);
  return { browser, page };
}

test('opens the requested aria-controls panel and scopes exact click targets', async () => {
  const { browser, page } = await newPage();
  try {
    await executeClickAction(page, {
      kind: 'click',
      role: 'button',
      name: 'Advanced Filter',
      controls: 'target-panel',
    });

    assert.equal(await page.locator('#target-panel').getAttribute('data-opened'), 'true');
    assert.equal(await page.locator('#wrong-panel').getAttribute('data-opened'), 'false');
    assert.equal(await page.locator('#target-panel').getAttribute('aria-expanded'), 'true');

    await executeClickAction(page, {
      kind: 'click',
      role: 'button',
      name: 'Add party filter',
      scope: { id: 'target-panel' },
    });

    assert.deepEqual(await page.evaluate(() => window.events), [
      { text: 'Advanced Filter', panel: null },
      { text: 'Add party filter', panel: null },
    ]);
  } finally {
    await browser.close();
  }
});

test('uses accessible region, label, placeholder, and selector lookup with strict scoping', async () => {
  const { browser, page } = await newPage();
  try {
    await executeFillAction(page, {
      kind: 'fill',
      label: 'Public Key',
      value: 'key-from-label',
      scope: { region: 'Expanded landmark' },
    });
    await executeFillAction(page, {
      kind: 'fill',
      placeholder: 'Party ID',
      value: 'party-from-placeholder',
      scope: { id: 'target-panel' },
    });
    await executeFillAction(page, {
      kind: 'fill',
      selector: '#selector-input',
      value: 'selector-value',
      scope: { ariaControls: 'target-panel' },
    });

    assert.equal(await page.locator('#public-key').inputValue(), 'key-from-label');
    assert.equal(await page.locator('#party').inputValue(), 'party-from-placeholder');
    assert.equal(await page.locator('#selector-input').inputValue(), 'selector-value');
  } finally {
    await browser.close();
  }
});

test('selects and checks the exact scoped controls and waits for a page selector', async () => {
  const { browser, page } = await newPage();
  try {
    await executeSelectAction(page, {
      kind: 'select',
      label: 'Movement Type',
      value: 'Mint',
      scope: { id: 'target-panel' },
    });
    await executeCheckAction(page, {
      kind: 'check',
      label: 'Node A',
      checked: true,
      scope: { id: 'target-panel' },
    });
    await page.evaluate(() => setTimeout(() => {
      const ready = document.createElement('div');
      ready.id = 'ready';
      ready.textContent = 'Ready';
      document.body.append(ready);
    }, 25));
    await executeWaitForAction(page, { kind: 'waitFor', selector: '#ready', timeoutMs: 1_000 });

    assert.equal(await page.locator('#movement').inputValue(), 'Mint');
    assert.equal(await page.locator('#node-a').isChecked(), true);
  } finally {
    await browser.close();
  }
});

test('resolves discovery values, including nodeId fallback from nodes', async () => {
  assert.equal(resolveActionValue('party', discoveryContext), 'Alice::party');
  assert.equal(resolveActionValue('updateId', discoveryContext), 'update-1');
  assert.equal(resolveActionValue('nodeId', { nodes: discoveryContext.nodes }), 'node-a');
  assert.deepEqual(resolveActionValue('nodes', discoveryContext), discoveryContext.nodes);

  const { browser, page } = await newPage();
  try {
    await executeFillAction(page, {
      kind: 'fill',
      placeholder: 'Party ID',
      valueFrom: 'party',
      scope: { id: 'target-panel' },
    }, { discoveryContext, metadata: errorMetadata });
    assert.equal(await page.locator('#party').inputValue(), discoveryContext.party);
  } finally {
    await browser.close();
  }
});

test('throws structured ambiguity, missing-control, and optional-skip errors with metadata', async () => {
  const { browser, page } = await newPage();
  try {
    await assert.rejects(
      executeClickAction(page, { kind: 'click', role: 'button', name: 'Apply filters' }, { metadata: errorMetadata }),
      (error) => {
        assert(error instanceof ActionExecutionError);
        assert.equal(error.code, 'ambiguous-control');
        assert.equal(error.kind, 'action');
        assert.deepEqual(error.metadata, errorMetadata);
        return true;
      },
    );
    await assert.rejects(
      executeFillAction(page, {
        kind: 'fill',
        placeholder: 'Party ID',
        valueFrom: 'missing-party',
        scope: { id: 'target-panel' },
      }, { discoveryContext: {}, required: false, metadata: errorMetadata }),
      (error) => {
        assert(error instanceof ActionExecutionError);
        assert.equal(error.code, 'missing-value');
        assert.equal(error.kind, 'optional-skip');
        assert.equal(error.valueFrom, 'missing-party');
        assert.deepEqual(error.metadata, errorMetadata);
        return true;
      },
    );
    await assert.rejects(
      executeClickAction(page, {
        kind: 'click',
        role: 'button',
        name: 'Does not exist',
        scope: { id: 'target-panel' },
      }, { required: false, metadata: errorMetadata }),
      (error) => {
        assert(error instanceof ActionExecutionError);
        assert.equal(error.code, 'missing-control');
        assert.equal(error.kind, 'optional-skip');
        assert.equal(error.metadata.panel, 'target-panel');
        assert.equal(error.metadata.route, 'updates');
        assert.equal(error.metadata.state, 'filters');
        assert.equal(error.target.description, 'button Does not exist');
        assert.equal(error.target.count, 0);
        return true;
      },
    );
  } finally {
    await browser.close();
  }
});

test('missing click role or name fails runtime validation', async () => {
  const { browser, page } = await newPage();
  try {
    for (const action of [
      { kind: 'click', name: 'Advanced Filter' },
      { kind: 'click', role: 'button' },
    ]) {
      await assert.rejects(
        executeClickAction(page, action),
        (error) => {
          assert(error instanceof ActionExecutionError);
          assert.equal(error.code, 'invalid-action');
          return true;
        },
      );
    }
  } finally {
    await browser.close();
  }
});

test('missing optional wait targets produce structured skips', async () => {
  const { browser, page } = await newPage();
  try {
    await assert.rejects(
      executeWaitForAction(
        page,
        { kind: 'waitFor', selector: '#missing-status', timeoutMs: 10 },
        { required: false, metadata: errorMetadata },
      ),
      (error) => {
        assert(error instanceof ActionExecutionError);
        assert.equal(error.code, 'missing-control');
        assert.equal(error.kind, 'optional-skip');
        assert.equal(error.target.description, 'selector #missing-status');
        assert.equal(error.target.count, 0);
        return true;
      },
    );
  } finally {
    await browser.close();
  }
});

test('executes every configured filter/search state through real accessible controls', async () => {
  const { browser, page } = await newPage();
  try {
    await page.setContent(allActionsFixture());
    const config = createDefaultConfig();
    const filterStates = config.routes
      .flatMap((route) => route.states
        .filter((state) => state.name === 'filters')
        .map((state) => ({ route: route.name, state })));

    for (const { route, state } of filterStates) {
      await executeScreenshotActions(page, state.actions, {
        discoveryContext,
        required: route.required && state.required,
        metadata: { route, state: state.name },
      });
    }

    const events = await page.evaluate(() => window.events);
    for (const expected of [
      'Add party filter',
      'Add template filter',
      'Add name filter',
      'Add issuer filter',
      'Add from party filter',
      'Add to party filter',
      'Add movement type filter',
      'Search Namespaces',
      'Apply filters',
    ]) {
      assert.ok(events.some((event) => event.text === expected), `missing applied action ${expected}`);
    }
    assert.equal(await page.locator('#home-updates-advanced-filter input[placeholder="Party ID"]').first().inputValue(), discoveryContext.party);
    assert.equal(await page.locator('#tokens-advanced-filter input[placeholder="Issuer"]').inputValue(), discoveryContext.issuer);
    assert.equal(await page.locator('#namespace-advanced-filter input').inputValue(), discoveryContext.publicKey);
    assert.equal(await page.locator('#traffic-purchases-advanced-search input:not([type="checkbox"])').nth(0).inputValue(), '2024-01-01');
    assert.equal(await page.getByRole('checkbox', { name: 'Node A', exact: true }).isChecked(), true);
    assert.equal(await page.getByRole('checkbox', { name: 'Node B', exact: true }).isChecked(), true);
  } finally {
    await browser.close();
  }
});
