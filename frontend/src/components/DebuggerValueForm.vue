<script setup lang="ts">
import { defineComponent, h, ref, watch, type VNode } from 'vue';
import type { PackageTypeNode } from '../types/packages';
import {
  UNSET,
  createFormValue,
  serializeFormValue,
  validateFormValue,
  type FormValue,
} from '../lib/debugger-value-form';

const props = withDefaults(
  defineProps<{
    schema: PackageTypeNode;
    resolveType?: (node: PackageTypeNode) => PackageTypeNode | null;
  }>(),
  { resolveType: undefined },
);

const emit = defineEmits<{
  value: [value: unknown | null];
  validity: [valid: boolean];
}>();

const formValue = ref<FormValue>(createFormValue(props.schema, props.resolveType));

function resolved(node: PackageTypeNode): PackageTypeNode {
  if (node.kind === 'type_con' && props.resolveType) {
    return props.resolveType(node) ?? node;
  }
  return node;
}

function labelFor(node: PackageTypeNode): string {
  return node.label.split('.').at(-1)?.split(':').at(-1) ?? node.label;
}

function inputValue(value: FormValue): string | boolean {
  if (value.kind !== 'scalar' || value.value === UNSET) {
    return '';
  }
  return value.value;
}

function updateScalar(value: FormValue, event: Event) {
  if (value.kind === 'scalar') {
    value.value = (event.target as HTMLInputElement).value;
  }
}

function renderValue(node: PackageTypeNode, value: FormValue, path: string, label?: string): VNode {
  const actualNode = resolved(node);
  const title = label ?? labelFor(actualNode);

  if (value.kind === 'unsupported') {
    return h('p', { class: 'debugger-value-form__error' }, value.message);
  }

  if (actualNode.kind === 'record' || actualNode.kind === 'struct') {
    const record = value.kind === 'record' ? value : null;
    return h('fieldset', { class: 'debugger-value-form__record', 'data-path': path }, [
      h('legend', title),
      ...(record
        ? (actualNode.fields ?? []).map((field) =>
          renderValue(field.type, record.fields[field.name]!, `${path}.${field.name}`, field.name),
        )
        : []),
    ]);
  }

  if (actualNode.kind === 'builtin') {
    const builtin = labelFor(actualNode);
    if (builtin === 'Optional' && value.kind === 'optional') {
      const present = value.value !== UNSET;
      const argument = actualNode.arguments?.[0];
      return h('div', { class: 'debugger-value-form__optional', 'data-path': path }, [
        h('label', { class: 'debugger-value-form__toggle' }, [
          h('input', {
            type: 'checkbox',
            checked: present,
            onChange: (event: Event) => {
              value.value = (event.target as HTMLInputElement).checked && argument
                ? createFormValue(argument, props.resolveType)
                : UNSET;
            },
          }),
          ` ${title} (optional)`,
        ]),
        present && argument && value.value !== UNSET
          ? renderValue(argument, value.value, path, title)
          : null,
      ]);
    }

    if (builtin === 'List' && value.kind === 'list') {
      const argument = actualNode.arguments?.[0];
      return h('fieldset', { class: 'debugger-value-form__collection', 'data-path': path }, [
        h('legend', title),
        ...value.items.map((item, index) => argument
          ? h('div', { class: 'debugger-value-form__collection-row' }, [
            renderValue(argument, item, `${path}.${index}`, `${title} ${index + 1}`),
            h('button', {
              type: 'button',
              onClick: () => value.items.splice(index, 1),
            }, 'Remove'),
          ]) : null),
        h('button', {
          type: 'button',
          onClick: () => {
            if (argument) value.items.push(createFormValue(argument, props.resolveType));
          },
        }, `Add ${title}`),
      ]);
    }

    if ((builtin === 'TextMap' || builtin === 'GenMap') && (value.kind === 'text_map' || value.kind === 'gen_map')) {
      const keyNode = builtin === 'TextMap' ? null : actualNode.arguments?.[0];
      const valueNode = actualNode.arguments?.[builtin === 'TextMap' ? 0 : 1];
      return h('fieldset', { class: 'debugger-value-form__collection', 'data-path': path }, [
        h('legend', title),
        ...value.entries.map((entry, index) => h('div', { class: 'debugger-value-form__map-row' }, [
          typeof entry.key === 'string'
            ? h('input', {
              value: entry.key,
              'aria-label': `${title} key ${index + 1}`,
              onInput: (event: Event) => { entry.key = (event.target as HTMLInputElement).value; },
            })
            : keyNode
              ? renderValue(keyNode, entry.key, `${path}.${index}.key`, 'Key')
              : null,
          valueNode ? renderValue(valueNode, entry.value, `${path}.${index}.value`, 'Value') : null,
          h('button', { type: 'button', onClick: () => value.entries.splice(index, 1) }, 'Remove'),
        ])),
        h('button', {
          type: 'button',
          onClick: () => {
            if (valueNode) value.entries.push({
              key: keyNode ? createFormValue(keyNode, props.resolveType) : '',
              value: createFormValue(valueNode, props.resolveType),
            });
          },
        }, `Add ${title} entry`),
      ]);
    }

    if (builtin === 'Unit') {
      return h('div', { class: 'debugger-value-form__unit', 'data-path': path }, `${title}: Unit`);
    }

    if (value.kind === 'scalar') {
      return h('label', { class: 'debugger-value-form__scalar', 'data-path': path }, [
        h('span', title),
        h('input', {
          type: builtin === 'Bool' ? 'checkbox' : 'text',
          checked: builtin === 'Bool' ? inputValue(value) : undefined,
          value: builtin === 'Bool' ? undefined : inputValue(value),
          onInput: (event: Event) => updateScalar(value, event),
          onChange: (event: Event) => {
            if (builtin === 'Bool' && value.kind === 'scalar') {
              value.value = (event.target as HTMLInputElement).checked;
            }
          },
        }),
      ]);
    }
  }

  if (actualNode.kind === 'enum' && value.kind === 'enum') {
    return h('label', { class: 'debugger-value-form__scalar', 'data-path': path }, [
      h('span', title),
      h('select', {
        value: value.constructor === UNSET ? '' : value.constructor,
        onChange: (event: Event) => { value.constructor = (event.target as HTMLSelectElement).value; },
      }, [
        h('option', { value: '' }, 'Choose…'),
        ...(actualNode.constructors ?? []).map((constructor) => h('option', { value: constructor.name }, constructor.name)),
      ]),
    ]);
  }

  if (actualNode.kind === 'variant' && value.kind === 'variant') {
    const selected = value.constructor === UNSET
      ? null
      : actualNode.constructors?.find((constructor) => constructor.name === value.constructor) ?? null;
    return h('div', { class: 'debugger-value-form__variant', 'data-path': path }, [
      h('label', { class: 'debugger-value-form__scalar' }, [
        h('span', title),
        h('select', {
          value: value.constructor === UNSET ? '' : value.constructor,
          onChange: (event: Event) => {
            const name = (event.target as HTMLSelectElement).value;
            const constructor = actualNode.constructors?.find((candidate) => candidate.name === name);
            value.constructor = name || UNSET;
            value.value = constructor?.type ? createFormValue(constructor.type, props.resolveType) : UNSET;
          },
        }, [
          h('option', { value: '' }, 'Choose…'),
          ...(actualNode.constructors ?? []).map((constructor) => h('option', { value: constructor.name }, constructor.name)),
        ]),
      ]),
      selected?.type && value.value !== UNSET
        ? renderValue(selected.type, value.value, `${path}.${selected.name}`, selected.name)
        : null,
    ]);
  }

  return h('p', { class: 'debugger-value-form__error' }, `${title}: Unsupported schema node.`);
}

function emitCurrent() {
  const errors = validateFormValue(formValue.value, props.schema);
  emit('validity', errors.length === 0);
  emit('value', errors.length === 0 ? serializeFormValue(formValue.value, props.schema) : null);
}

watch(
  () => props.schema,
  (schema) => {
    formValue.value = createFormValue(schema, props.resolveType);
    emitCurrent();
  },
  { immediate: true },
);

watch(formValue, emitCurrent, { deep: true });

const FormRenderer = defineComponent({
  name: 'DebuggerValueFormRenderer',
  setup: () => () => renderValue(props.schema, formValue.value, 'root', 'Constructor arguments'),
});
</script>

<template>
  <div class="debugger-value-form" data-testid="debugger-value-form">
    <div class="debugger-value-form__body">
      <FormRenderer />
    </div>
  </div>
</template>
