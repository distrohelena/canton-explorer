<script setup lang="ts">
import type { PackageTypeNode } from '../types/packages';

const props = withDefaults(defineProps<{
  node: PackageTypeNode;
  hideHeadline?: boolean;
  definitionDepth?: number;
  maxDefinitionDepth?: number | null;
}>(), {
  hideHeadline: false,
  definitionDepth: 0,
  maxDefinitionDepth: null,
});

function nodeHasChildren(node: PackageTypeNode): boolean {
  return (
    (node.fields?.length ?? 0) > 0 ||
    (node.constructors?.length ?? 0) > 0 ||
    (node.arguments?.length ?? 0) > 0 ||
    Boolean(node.view) ||
    (node.requires?.length ?? 0) > 0 ||
    (node.methods?.length ?? 0) > 0 ||
    (node.choices?.length ?? 0) > 0 ||
    Boolean(node.definition) ||
    Boolean(node.body)
  );
}

function noteLabel(note: PackageTypeNode['note']): string | null {
  switch (note) {
    case 'recursive_reference':
      return 'Recursive Reference';
    case 'missing_definition':
      return 'Definition Not Available';
    case 'unsupported':
      return 'Unsupported';
    default:
      return null;
  }
}

function kindLabel(kind: PackageTypeNode['kind']): string {
  return kind.replaceAll('_', ' ');
}

function shouldRenderDefinition(node: PackageTypeNode): boolean {
  if (!node.definition) {
    return false;
  }

  if (props.maxDefinitionDepth === null) {
    return true;
  }

  return props.definitionDepth < props.maxDefinitionDepth;
}
</script>

<template>
  <div class="package-tree" :class="{ 'package-tree--embedded': hideHeadline }">
    <div v-if="hideHeadline" class="package-tree__embedded-head">
      <span class="package-tree__embedded-kind">{{ kindLabel(node.kind) }}</span>
      <span v-if="noteLabel(node.note)" class="package-tree__note">{{ noteLabel(node.note) }}</span>
    </div>

    <div v-if="!hideHeadline" class="package-tree__headline">
      <span class="package-tree__kind">{{ kindLabel(node.kind) }}</span>
      <span class="package-tree__label">{{ node.label }}</span>
      <span v-if="noteLabel(node.note)" class="package-tree__note">{{ noteLabel(node.note) }}</span>
    </div>

    <div v-if="node.typeParameters?.length" class="package-tree__meta">
      Type Parameters: {{ node.typeParameters.join(', ') }}
    </div>

    <div v-if="node.arguments?.length" class="package-tree__group">
      <div class="package-tree__group-title">Arguments</div>
      <div class="package-tree__children">
        <PackageTypeTree
          v-for="(argument, index) in node.arguments"
          :key="`${node.label}-argument-${index}`"
          :node="argument"
          :definition-depth="definitionDepth"
          :max-definition-depth="maxDefinitionDepth"
        />
      </div>
    </div>

    <div v-if="node.fields?.length" class="package-tree__group">
      <div class="package-tree__group-title">Fields</div>
      <div class="package-tree__rows">
        <div
          v-for="field in node.fields"
          :key="`${node.label}-field-${field.name}`"
          class="package-tree__row"
        >
          <div class="package-tree__row-label">{{ field.name }}</div>
          <PackageTypeTree
            :node="field.type"
            :definition-depth="definitionDepth"
            :max-definition-depth="maxDefinitionDepth"
          />
        </div>
      </div>
    </div>

    <div v-if="node.constructors?.length" class="package-tree__group">
      <div class="package-tree__group-title">
        {{ node.kind === 'enum' ? 'Constructors' : 'Variants' }}
      </div>
      <div class="package-tree__rows">
        <div
          v-for="constructorNode in node.constructors"
          :key="`${node.label}-constructor-${constructorNode.name}`"
          class="package-tree__row"
        >
          <div class="package-tree__row-label">{{ constructorNode.name }}</div>
          <PackageTypeTree
            v-if="constructorNode.type"
            :node="constructorNode.type"
            :definition-depth="definitionDepth"
            :max-definition-depth="maxDefinitionDepth"
          />
        </div>
      </div>
    </div>

    <div v-if="node.view" class="package-tree__group">
      <div class="package-tree__group-title">View</div>
      <div class="package-tree__children">
        <PackageTypeTree
          :node="node.view"
          :definition-depth="definitionDepth"
          :max-definition-depth="maxDefinitionDepth"
        />
      </div>
    </div>

    <div v-if="node.requires?.length" class="package-tree__group">
      <div class="package-tree__group-title">Requires</div>
      <div class="package-tree__children">
        <PackageTypeTree
          v-for="(requiredInterface, index) in node.requires"
          :key="`${node.label}-requires-${index}`"
          :node="requiredInterface"
          :definition-depth="definitionDepth"
          :max-definition-depth="maxDefinitionDepth"
        />
      </div>
    </div>

    <div v-if="node.methods?.length" class="package-tree__group">
      <div class="package-tree__group-title">Methods</div>
      <div class="package-tree__rows">
        <div
          v-for="method in node.methods"
          :key="`${node.label}-method-${method.name}`"
          class="package-tree__row"
        >
          <div class="package-tree__row-label">{{ method.name }}</div>
          <PackageTypeTree
            v-if="method.type"
            :node="method.type"
            :definition-depth="definitionDepth"
            :max-definition-depth="maxDefinitionDepth"
          />
        </div>
      </div>
    </div>

    <div v-if="node.choices?.length" class="package-tree__group">
      <div class="package-tree__group-title">Choices</div>
      <div class="package-tree__rows">
        <div
          v-for="choice in node.choices"
          :key="`${node.label}-choice-${choice.name}`"
          class="package-tree__row package-tree__row--stacked"
        >
          <div class="package-tree__row-label">{{ choice.name }}</div>
          <div class="package-tree__choice">
            <div class="package-tree__meta">
              {{ choice.consuming ? 'Consuming' : 'Non-Consuming' }}
            </div>
            <div v-if="choice.argumentType" class="package-tree__group">
              <div class="package-tree__group-title">Argument</div>
              <div class="package-tree__children">
                <PackageTypeTree
                  :node="choice.argumentType"
                  :definition-depth="definitionDepth"
                  :max-definition-depth="maxDefinitionDepth"
                />
              </div>
            </div>
            <div v-if="choice.resultType" class="package-tree__group">
              <div class="package-tree__group-title">Result</div>
              <div class="package-tree__children">
                <PackageTypeTree
                  :node="choice.resultType"
                  :definition-depth="definitionDepth"
                  :max-definition-depth="maxDefinitionDepth"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="shouldRenderDefinition(node)" class="package-tree__group">
      <div class="package-tree__group-title">Definition</div>
      <div class="package-tree__children">
        <PackageTypeTree
          :node="node.definition!"
          :definition-depth="definitionDepth + 1"
          :max-definition-depth="maxDefinitionDepth"
        />
      </div>
    </div>

    <div v-if="node.body" class="package-tree__group">
      <div class="package-tree__group-title">Body</div>
      <div class="package-tree__children">
        <PackageTypeTree
          :node="node.body"
          :definition-depth="definitionDepth"
          :max-definition-depth="maxDefinitionDepth"
        />
      </div>
    </div>

    <div v-if="!nodeHasChildren(node)" class="package-tree__leaf">
      Leaf type
    </div>
  </div>
</template>
