<script setup lang="ts">
import type { PackageTypeField, PackageTypeNode } from '../types/packages';

const props = defineProps<{
  node: PackageTypeNode;
}>();

function formatTypeLabel(node: PackageTypeNode | null | undefined): string {
  if (!node) {
    return 'n/a';
  }

  const base = node.label;
  if (!node.arguments?.length) {
    return base;
  }

  return `${base}<${node.arguments.map((argument) => formatTypeLabel(argument)).join(', ')}>`;
}

function directFields(node: PackageTypeNode | null | undefined): PackageTypeField[] {
  if (!node) {
    return [];
  }

  return node.fields ?? [];
}

function interfaceViewFields(node: PackageTypeNode): PackageTypeField[] {
  return directFields(node.view?.definition ?? node.view);
}

function hasInlineStructure(node: PackageTypeNode): boolean {
  return (
    (node.fields?.length ?? 0) > 0 ||
    (node.constructors?.length ?? 0) > 0 ||
    (node.kind === 'interface' &&
      ((interfaceViewFields(node).length > 0) ||
        (node.requires?.length ?? 0) > 0 ||
        (node.methods?.length ?? 0) > 0 ||
        (node.choices?.length ?? 0) > 0))
  );
}
</script>

<template>
  <div class="package-schema">
    <div class="package-schema__kind">{{ node.kind.replaceAll('_', ' ') }}</div>

    <div v-if="node.fields?.length" class="package-schema__rows">
      <div
        v-for="field in node.fields"
        :key="`${node.label}-field-${field.name}`"
        class="package-schema__row"
      >
        <div class="package-schema__label">{{ field.name }}</div>
        <div class="package-schema__value">{{ formatTypeLabel(field.type) }}</div>
      </div>
    </div>

    <div v-else-if="node.constructors?.length" class="package-schema__rows">
      <div
        v-for="constructorNode in node.constructors"
        :key="`${node.label}-constructor-${constructorNode.name}`"
        class="package-schema__row"
      >
        <div class="package-schema__label">{{ constructorNode.name }}</div>
        <div class="package-schema__value">
          {{ constructorNode.type ? formatTypeLabel(constructorNode.type) : 'n/a' }}
        </div>
      </div>
    </div>

    <div v-else-if="node.kind === 'interface'" class="package-schema__groups">
      <div v-if="node.view" class="package-schema__group">
        <div class="package-schema__group-title">View</div>
        <div class="package-schema__group-value">{{ formatTypeLabel(node.view) }}</div>
        <div v-if="interfaceViewFields(node).length" class="package-schema__rows">
          <div
            v-for="field in interfaceViewFields(node)"
            :key="`${node.label}-view-field-${field.name}`"
            class="package-schema__row"
          >
            <div class="package-schema__label">{{ field.name }}</div>
            <div class="package-schema__value">{{ formatTypeLabel(field.type) }}</div>
          </div>
        </div>
      </div>

      <div v-if="node.requires?.length" class="package-schema__group">
        <div class="package-schema__group-title">Requires</div>
        <div class="package-schema__rows">
          <div
            v-for="(requiredInterface, index) in node.requires"
            :key="`${node.label}-required-${index}`"
            class="package-schema__row"
          >
            <div class="package-schema__label">Interface</div>
            <div class="package-schema__value">{{ formatTypeLabel(requiredInterface) }}</div>
          </div>
        </div>
      </div>

      <div v-if="node.methods?.length" class="package-schema__group">
        <div class="package-schema__group-title">Methods</div>
        <div class="package-schema__rows">
          <div
            v-for="method in node.methods"
            :key="`${node.label}-method-${method.name}`"
            class="package-schema__row"
          >
            <div class="package-schema__label">{{ method.name }}</div>
            <div class="package-schema__value">{{ formatTypeLabel(method.type) }}</div>
          </div>
        </div>
      </div>

      <div v-if="node.choices?.length" class="package-schema__group">
        <div class="package-schema__group-title">Choices</div>
        <div class="package-schema__rows">
          <div
            v-for="choice in node.choices"
            :key="`${node.label}-choice-${choice.name}`"
            class="package-schema__row package-schema__row--choice"
          >
            <div class="package-schema__label">{{ choice.name }}</div>
            <div class="package-schema__value">
              <span class="package-schema__choice-mode">
                {{ choice.consuming ? 'Consuming' : 'Non-Consuming' }}
              </span>
              <span v-if="choice.argumentType">
                Arg: {{ formatTypeLabel(choice.argumentType) }}
              </span>
              <span v-if="choice.resultType">
                Result: {{ formatTypeLabel(choice.resultType) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="node.definition && hasInlineStructure(node.definition)">
      <PackageTypeInlineSchema :node="node.definition" />
    </div>

    <div v-else class="package-schema__empty">
      {{ formatTypeLabel(node) }}
    </div>
  </div>
</template>
