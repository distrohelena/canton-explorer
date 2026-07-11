import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  validateOptions(options)

  const sdk = await import('@distrohelena/canton-typescript-sdk/daml-lf')
  const archiveLoader = new sdk.DarArchiveLoader()
  const packageLoader = new sdk.DamlLfPackageLoader()
  const archive = await archiveLoader.loadDarOrThrowAsync(readFileSync(options.inputDar))
  const rawPackage = packageLoader.loadRawPackageOrThrow(archive.mainPackageEntry.bytes)
  const compiledPackage = packageLoader.loadPackageOrThrow(archive.mainPackageEntry.bytes)
  const debugDalfBytes = resolveDebugDalfBytes(options, archive)
  const debugPackage = debugDalfBytes
    ? packageLoader.loadPackageOrThrow(debugDalfBytes)
    : undefined

  const packageDirectory = resolvePackageDirectory(
    options.workspaceRoot,
    options.packageDir,
    compiledPackage.packageName,
  )
  const damlYaml = parseDamlYaml(path.join(packageDirectory, 'daml.yaml'))
  const sourceDirectory = path.resolve(packageDirectory, damlYaml.source)
  const archiveSourcePrefix = normalizeArchivePath(options.sourcePrefix || damlYaml.source)
  const sourceModules = collectSourceModules(
    sourceDirectory,
    archiveSourcePrefix,
    options.workspaceRoot,
  )
  const compiledModules = compiledPackage.modules.map((module) => {
    const sourceModule = sourceModules.get(module.name)
    const definitions = module.definitions.filter((definition) => definition.nodeKind === 'valueDefinition')
    return {
      moduleName: module.name,
      sourceModule,
      definitions,
    }
  })

  const executables = []
  let exactMatches = 0
  let fallbackMatches = 0
  let missingModules = 0

  for (const compiledModule of compiledModules) {
    if (compiledModule.sourceModule === undefined) {
      missingModules += 1
      continue
    }

    for (const definition of compiledModule.definitions) {
      const mapping = resolveDefinitionMapping(definition.name, compiledModule.sourceModule)

      if (mapping.kind === 'exact') {
        exactMatches += 1
      } else {
        fallbackMatches += 1
      }

      executables.push({
        packageId: compiledPackage.packageId,
        moduleName: compiledModule.moduleName,
        definitionName: definition.name,
        path: compiledModule.sourceModule.archivePath,
        startLine: mapping.span.startLine,
        startColumn: mapping.span.startColumn,
        endLine: mapping.span.endLine,
        endColumn: mapping.span.endColumn,
        precision: mapping.kind,
        ...(mapping.entrypointKind ? { entrypointKind: mapping.entrypointKind } : {}),
        ...(mapping.templateName ? { templateName: mapping.templateName } : {}),
        ...(mapping.choiceName ? { choiceName: mapping.choiceName } : {}),
        ...(mapping.choiceArgumentFieldName
          ? { choiceArgumentFieldName: mapping.choiceArgumentFieldName }
          : {}),
      })
    }
  }

  const importedPackages = await collectImportedPackageIds(
    rawPackage.rawPackage,
    compiledPackage,
    options.workspaceImportsOnly
      ? await collectWorkspacePackageIds(options.workspaceRoot, options.packageDir)
      : undefined,
  )
  const expressionLocationResult = debugPackage
    ? collectExpressionLocations(compiledPackage, debugPackage, sourceModules)
    : { locations: [], skippedDefinitions: [] }
  const expressionLocations = expressionLocationResult.locations
  const interfaceChoiceExecutables = collectInterfaceChoiceExecutables(
    compiledPackage.packageId,
    compiledModules,
    executables,
    expressionLocations,
  )

  const metadata = {
    packageId: compiledPackage.packageId,
    importedPackages,
    executables: [...executables, ...interfaceChoiceExecutables],
    expressionLocations,
  }

  writeFileSync(options.outputPath, JSON.stringify(metadata, null, 2))

  console.log(`Wrote source map: ${options.outputPath}`)
  console.log(`Package: ${compiledPackage.packageName}@${compiledPackage.packageVersion}`)
  console.log(`Definitions mapped: ${executables.length}`)
  console.log(`Exact matches: ${exactMatches}`)
  console.log(`Module fallbacks: ${fallbackMatches}`)
  if (interfaceChoiceExecutables.length > 0) {
    console.log(`Interface choice executables: ${interfaceChoiceExecutables.length}`)
  }
  console.log(`Expression locations: ${expressionLocations.length}`)
  if (expressionLocationResult.skippedDefinitions.length > 0) {
    console.log(
      `Skipped non-isomorphic debug definitions: ${expressionLocationResult.skippedDefinitions.length}`,
    )
  }
  if (missingModules > 0) {
    console.log(`Source modules not found: ${missingModules}`)
  }
}

function parseArgs(argv) {
  const options = {
    help: false,
    inputDar: '',
    outputPath: '',
    workspaceRoot: '',
    packageDir: '',
    sourcePrefix: '',
    debugDalfPath: '',
    workspaceImportsOnly: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    switch (argument) {
      case '--help':
      case '-h':
        options.help = true
        break
      case '--input':
        options.inputDar = requireValue(argv, ++index, '--input')
        break
      case '--output':
        options.outputPath = requireValue(argv, ++index, '--output')
        break
      case '--workspace-root':
        options.workspaceRoot = requireValue(argv, ++index, '--workspace-root')
        break
      case '--package-dir':
        options.packageDir = requireValue(argv, ++index, '--package-dir')
        break
      case '--source-prefix':
        options.sourcePrefix = requireValue(argv, ++index, '--source-prefix')
        break
      case '--debug-dalf':
        options.debugDalfPath = requireValue(argv, ++index, '--debug-dalf')
        break
      case '--workspace-imports-only':
        options.workspaceImportsOnly = true
        break
      default:
        throw new Error(`Unknown argument: ${argument}`)
    }
  }

  if (!options.outputPath && options.inputDar) {
    options.outputPath = defaultOutputPath(options.inputDar)
  }

  return options
}

function validateOptions(options) {
  if (!options.inputDar) {
    throw new Error('--input is required')
  }
  if (!options.workspaceRoot && !options.packageDir) {
    throw new Error('--workspace-root is required unless --package-dir is provided')
  }
  if (!statExists(options.inputDar, 'file')) {
    throw new Error(`Input DAR not found: ${options.inputDar}`)
  }
  if (options.workspaceRoot && !statExists(options.workspaceRoot, 'directory')) {
    throw new Error(`Workspace root not found: ${options.workspaceRoot}`)
  }
  if (options.packageDir && !statExists(options.packageDir, 'directory')) {
    throw new Error(`Package directory not found: ${options.packageDir}`)
  }
  if (options.debugDalfPath && !statExists(options.debugDalfPath, 'file')) {
    throw new Error(`Debug DALF not found: ${options.debugDalfPath}`)
  }
}

function resolveDebugDalfBytes(options, archive) {
  if (options.debugDalfPath) {
    return readFileSync(options.debugDalfPath)
  }

  const debugEntry = archive.entries.find(
    (entry) =>
      (
        entry.path.startsWith('debug/') ||
        entry.path.endsWith('/data/debug-locations.dalf')
      ) &&
      entry.path.endsWith('.dalf'),
  )

  return debugEntry?.bytes
}

function collectExpressionLocations(productionPackage, debugPackage, sourceModules) {
  const locations = []
  const skippedDefinitions = []
  const debugModules = new Map(debugPackage.modules.map((module) => [module.name, module]))
  const packageIdEquivalence = new Map([
    [productionPackage.packageId, debugPackage.packageId],
    [debugPackage.packageId, productionPackage.packageId],
  ])

  for (const productionModule of productionPackage.modules) {
    const debugModule = debugModules.get(productionModule.name)

    if (debugModule === undefined) {
      throw new Error(`debug DALF is missing module ${productionModule.name}`)
    }

    const productionDefinitions = productionModule.definitions.filter(
      (definition) => definition.nodeKind === 'valueDefinition',
    )
    const debugDefinitions = new Map(
      debugModule.definitions
        .filter((definition) => definition.nodeKind === 'valueDefinition')
        .map((definition) => [definition.name, definition]),
    )
    for (const productionDefinition of productionDefinitions) {
      const debugDefinition = debugDefinitions.get(productionDefinition.name)

      if (debugDefinition === undefined) {
        throw new Error(
          `debug DALF is missing definition ${productionModule.name}:${productionDefinition.name}`,
        )
      }

      if (
        !structurallyEqualIgnoringSourceLocation(
          productionDefinition.expression,
          debugDefinition.expression,
          packageIdEquivalence,
        )
      ) {
        skippedDefinitions.push(`${productionModule.name}:${productionDefinition.name}`)
        continue
      }

      collectExpressionLocationsFromExpression({
        packageId: productionPackage.packageId,
        moduleName: productionModule.name,
        definitionName: productionDefinition.name,
        productionExpression: productionDefinition.expression,
        debugExpression: debugDefinition.expression,
        expressionPath: [],
        sourceModules,
        packageIdEquivalence,
        locations,
      })
    }
  }

  return { locations, skippedDefinitions }
}

function collectInterfaceChoiceExecutables(
  packageId,
  compiledModules,
  executables,
  expressionLocations,
) {
  const existingExerciseKeys = new Set(
    executables
      .filter((candidate) => candidate.entrypointKind === 'exercise')
      .map((candidate) =>
        `${candidate.packageId}::${candidate.moduleName}::${candidate.templateName}::${candidate.choiceName}`,
      ),
  )
  const expressionLocationsByDefinition = new Map()

  for (const location of expressionLocations) {
    const key = `${location.moduleName}::${location.definitionName}`
    const locations = expressionLocationsByDefinition.get(key) ?? []
    locations.push(location)
    expressionLocationsByDefinition.set(key, locations)
  }

  const resolvedExecutables = []

  for (const compiledModule of compiledModules) {
    const sourceModule = compiledModule.sourceModule
    if (sourceModule === undefined) {
      continue
    }

    for (const implementation of sourceModule.interfaceChoiceImplementations) {
      const executableKey =
        `${packageId}::${compiledModule.moduleName}::${implementation.templateName}::${implementation.choiceName}`
      if (existingExerciseKeys.has(executableKey)) {
        continue
      }

      const definitionName = resolveInterfaceChoiceDefinitionName(
        compiledModule.moduleName,
        compiledModule.definitions,
        implementation.span,
        implementation.templateName,
        expressionLocationsByDefinition,
      )

      if (definitionName === undefined) {
        continue
      }

      resolvedExecutables.push({
        packageId,
        moduleName: compiledModule.moduleName,
        definitionName,
        path: sourceModule.archivePath,
        startLine: implementation.span.startLine,
        startColumn: implementation.span.startColumn,
        endLine: implementation.span.endLine,
        endColumn: implementation.span.endColumn,
        precision: 'exact',
        entrypointKind: 'exercise',
        templateName: implementation.templateName,
        choiceName: implementation.choiceName,
        choiceArgumentFieldName: implementation.choiceArgumentFieldName,
      })
      existingExerciseKeys.add(executableKey)
    }
  }

  return resolvedExecutables
}

function resolveInterfaceChoiceDefinitionName(
  moduleName,
  definitions,
  span,
  templateName,
  expressionLocationsByDefinition,
) {
  let bestCandidate

  for (const definition of definitions) {
    const key = `${moduleName}::${definition.name}`
    const locations = expressionLocationsByDefinition.get(key)
    if (locations === undefined || locations.length === 0) {
      continue
    }

    const overlappingLines = new Set()
    for (const location of locations) {
      if (
        location.startLine >= span.startLine - 1
        && location.startLine <= span.endLine
      ) {
        overlappingLines.add(location.startLine)
      }
    }

    if (overlappingLines.size === 0) {
      continue
    }

    const candidate = {
      definitionName: definition.name,
      overlapScore: overlappingLines.size,
      preferredTemplateScope:
        definition.name.startsWith(`$$$$sc_${templateName}_`) ? 1 : 0,
    }

    if (
      bestCandidate === undefined
      || candidate.overlapScore > bestCandidate.overlapScore
      || (
        candidate.overlapScore === bestCandidate.overlapScore
        && candidate.preferredTemplateScope > bestCandidate.preferredTemplateScope
      )
    ) {
      bestCandidate = candidate
    }
  }

  return bestCandidate?.definitionName
}

function collectExpressionLocationsFromExpression({
  packageId,
  moduleName,
  definitionName,
  productionExpression,
  debugExpression,
  expressionPath,
  sourceModules,
  packageIdEquivalence,
  locations,
}) {
  if (
    !structurallyEqualIgnoringSourceLocation(
      productionExpression,
      debugExpression,
      packageIdEquivalence,
    )
  ) {
    throw new Error(
      `debug DALF expression mismatch at ${moduleName}:${definitionName} path ${expressionPath.join('.')}`,
    )
  }

  const sourceLocation = debugExpression.sourceLocation
  if (sourceLocation !== undefined) {
    const sourceModule = sourceModules.get(sourceLocation.moduleName ?? moduleName)

    if (sourceModule !== undefined) {
      locations.push({
        packageId,
        moduleName,
        definitionName,
        expressionPath,
        path: sourceModule.archivePath,
        startLine: sourceLocation.startLine,
        startColumn: sourceLocation.startColumn,
        endLine: sourceLocation.endLine,
        endColumn: sourceLocation.endColumn,
      })
    }
  }

  const productionChildren = getExpressionChildren(productionExpression)
  const debugChildren = getExpressionChildren(debugExpression)

  if (productionChildren.length !== debugChildren.length) {
    throw new Error(
      `debug DALF child count mismatch at ${moduleName}:${definitionName} path ${expressionPath.join('.')}`,
    )
  }

  for (let index = 0; index < productionChildren.length; index += 1) {
    collectExpressionLocationsFromExpression({
      packageId,
      moduleName,
      definitionName,
      productionExpression: productionChildren[index],
      debugExpression: debugChildren[index],
      expressionPath: [...expressionPath, index],
      sourceModules,
      packageIdEquivalence,
      locations,
    })
  }
}

function structurallyEqualIgnoringSourceLocation(left, right, packageIdEquivalence, parentKey = '') {
  if (left === right) {
    return true
  }

  if (
    parentKey === 'packageId' &&
    typeof left === 'string' &&
    typeof right === 'string' &&
    packageIdEquivalence.get(left) === right
  ) {
    return true
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false
    }
    return left.every((item, index) =>
      structurallyEqualIgnoringSourceLocation(item, right[index], packageIdEquivalence, parentKey),
    )
  }

  if (left && right && typeof left === 'object' && typeof right === 'object') {
    const leftKeys = Object.keys(left).filter((key) => key !== 'sourceLocation')
    const rightKeys = Object.keys(right).filter((key) => key !== 'sourceLocation')

    if (leftKeys.length !== rightKeys.length) {
      return false
    }

    for (let index = 0; index < leftKeys.length; index += 1) {
      const key = leftKeys[index]

      if (key !== rightKeys[index]) {
        return false
      }

      if (
        !structurallyEqualIgnoringSourceLocation(
          left[key],
          right[key],
          packageIdEquivalence,
          key,
        )
      ) {
        return false
      }
    }

    return true
  }

  return false
}

function getExpressionChildren(expression) {
  if (expression.lambda !== undefined) {
    return [expression.lambda.body]
  }

  if (expression.application !== undefined) {
    return [
      expression.application.function,
      ...expression.application.arguments,
    ]
  }

  if (expression.letExpression !== undefined) {
    return [
      ...expression.letExpression.bindings.map((binding) => binding.value),
      expression.letExpression.body,
    ]
  }

  if (expression.recordConstruction !== undefined) {
    return expression.recordConstruction.fields.map((field) => field.value)
  }

  if (expression.recordProjection !== undefined) {
    return [expression.recordProjection.record]
  }

  if (expression.recordUpdate !== undefined) {
    return [
      expression.recordUpdate.record,
      expression.recordUpdate.value,
    ]
  }

  if (expression.caseExpression !== undefined) {
    return [
      expression.caseExpression.scrutinee,
      ...expression.caseExpression.alternatives.map((alternative) => alternative.body),
    ]
  }

  if (expression.variantConstruction !== undefined) {
    return [expression.variantConstruction.argument]
  }

  if (expression.optionalConstruction?.value !== undefined) {
    return [expression.optionalConstruction.value]
  }

  if (expression.listConstruction !== undefined) {
    return [
      ...expression.listConstruction.front,
      ...(expression.listConstruction.tail === undefined
        ? []
        : [expression.listConstruction.tail]),
    ]
  }

  if (expression.updateExpression !== undefined) {
    return [
      ...(expression.updateExpression.expression === undefined
        ? []
        : [expression.updateExpression.expression]),
      ...(expression.updateExpression.bindings?.map((binding) => binding.value) ?? []),
      ...(expression.updateExpression.body === undefined
        ? []
        : [expression.updateExpression.body]),
      ...(expression.updateExpression.contractId === undefined
        ? []
        : [expression.updateExpression.contractId]),
      ...(expression.updateExpression.argument === undefined
        ? []
        : [expression.updateExpression.argument]),
    ]
  }

  return []
}

function resolveDefinitionMapping(definitionName, sourceModule) {
  const exactValue = sourceModule.values.get(definitionName)
  if (exactValue !== undefined) {
    return {
      kind: 'exact',
      span: exactValue,
    }
  }

  const recursiveStrip = stripScopeWrapper(definitionName)
  if (recursiveStrip !== definitionName) {
    const nested = resolveDefinitionMapping(recursiveStrip, sourceModule)
    return nested.kind === 'exact'
      ? nested
      : {
          kind: 'fallback',
          span: nested.span,
          entrypointKind: nested.entrypointKind,
          templateName: nested.templateName,
          choiceName: nested.choiceName,
        }
  }

  const decodedName = decodeGeneratedName(definitionName)

  const fieldSpan = resolveFieldMapping(decodedName, sourceModule)
  if (fieldSpan !== undefined) {
    return {
      kind: 'exact',
      span: fieldSpan,
    }
  }

  const generatedEntity = resolveGeneratedEntityMapping(definitionName, decodedName, sourceModule)
  if (generatedEntity !== undefined) {
    return generatedEntity
  }

  const ordinalTemplateSpan = resolveOrdinalTemplateFamily(decodedName, sourceModule)
  if (ordinalTemplateSpan !== undefined) {
    return {
      kind: 'fallback',
      span: ordinalTemplateSpan,
    }
  }

  const ordinalTypeSpan = resolveOrdinalTypeFamily(decodedName, sourceModule)
  if (ordinalTypeSpan !== undefined) {
    return {
      kind: 'fallback',
      span: ordinalTypeSpan,
    }
  }

  return {
    kind: 'fallback',
    span: sourceModule.moduleSpan,
  }
}

function resolveGeneratedEntityMapping(definitionName, decodedName, sourceModule) {
  const createMatch = matchTemplateSuffix(definitionName, sourceModule.templates, ['$$fHasCreate'])
  if (createMatch !== undefined) {
    return {
      kind: 'exact',
      span: createMatch.span,
      entrypointKind: 'create',
      templateName: createMatch.name,
    }
  }

  const templatePrefixes = [
    '$$fHasFetch',
    '$$fHasArchive',
    '$$fHasObserver',
    '$$fHasSignatory',
    '$$fHasEnsure',
    '$$fHasIsInterfaceType',
    '$$fHasTemplateTypeRep',
    '$$fHasToAnyTemplate',
    '$$fHasFromAnyTemplate',
    '$$fHasToInterface',
    '$$fHasFromInterface',
    '$$W',
    '$$fShow',
    '$$fEq',
  ]

  const templateMatch = matchTemplateSuffix(definitionName, sourceModule.templates, templatePrefixes)
  if (templateMatch !== undefined) {
    return {
      kind: 'exact',
      span: templateMatch.span,
    }
  }

  const typePrefixes = ['$$W', '$$fShow', '$$fEq']
  const dataTypeMatch = matchTemplateSuffix(definitionName, sourceModule.dataTypes, typePrefixes)
  if (dataTypeMatch !== undefined) {
    return {
      kind: 'exact',
      span: dataTypeMatch.span,
    }
  }

  const choiceMatch = matchChoiceSuffix(definitionName, sourceModule, [
    '$$fHasExercise',
    '$$fHasToAnyChoice',
    '$$fHasFromAnyChoice',
  ])
  if (choiceMatch !== undefined) {
    return choiceMatch
  }

  const decodedChoiceMatch = matchChoiceSuffix(decodedName, sourceModule, [
    '$$fHasExercise',
    '$$fHasToAnyChoice',
    '$$fHasFromAnyChoice',
  ])
  if (decodedChoiceMatch !== undefined) {
    return decodedChoiceMatch
  }

  if (definitionName.startsWith('$$fHasExercise') && definitionName.endsWith('Archive$u0028$u0029')) {
    const template = matchTemplatePrefix(
      definitionName.slice('$$fHasExercise'.length, -'Archive$u0028$u0029'.length),
      sourceModule.templates,
    )
    if (template !== undefined) {
      return {
        kind: 'exact',
        span: template.span,
        entrypointKind: 'exercise',
        templateName: template.name,
        choiceName: 'Archive',
      }
    }
  }

  if (definitionName.startsWith('$$fHasExercise') && definitionName.endsWith('Archive()')) {
    const template = matchTemplatePrefix(
      definitionName.slice('$$fHasExercise'.length, -'Archive()'.length),
      sourceModule.templates,
    )
    if (template !== undefined) {
      return {
        kind: 'exact',
        span: template.span,
        entrypointKind: 'exercise',
        templateName: template.name,
        choiceName: 'Archive',
      }
    }
  }

  return undefined
}

function resolveFieldMapping(decodedName, sourceModule) {
  const selectorMatch = /^\$\$sel:([^:]+):(.+)$/.exec(decodedName)
  if (selectorMatch) {
    const fieldName = selectorMatch[1]
    const typeName = selectorMatch[2]
    const entity = sourceModule.templateOrDataEntities.find((candidate) => candidate.name === typeName)
    return entity?.fields.get(fieldName)
  }

  const accessorMatch = /^\$\$f(?:Get|Set)Field"([^"]+)"(.+)$/.exec(decodedName)
  if (accessorMatch) {
    const fieldName = accessorMatch[1]
    const typeMatch = matchTemplatePrefix(accessorMatch[2], sourceModule.templateOrDataEntityMap)
    return typeMatch?.fields.get(fieldName)
  }

  return undefined
}

function resolveOrdinalTemplateFamily(decodedName, sourceModule) {
  const match = /^\$\$c(?:archive|observer|signatory|ensure)(\d*)$/.exec(decodedName)
  if (!match) {
    return undefined
  }
  const index = match[1] === '' ? 0 : Number.parseInt(match[1], 10)
  return sourceModule.templateOrder[index]?.span
}

function resolveOrdinalTypeFamily(decodedName, sourceModule) {
  const match = /^\$\$c(?:show|showList|showsPrec|==|\/=)(\d*)$/.exec(decodedName)
  if (!match) {
    return undefined
  }
  const index = match[1] === '' ? 0 : Number.parseInt(match[1], 10)
  return sourceModule.typeOrder[index]?.span
}

function matchTemplateSuffix(definitionName, entities, prefixes) {
  for (const prefix of prefixes) {
    if (!definitionName.startsWith(prefix)) {
      continue
    }

    const suffix = definitionName.slice(prefix.length)
    const entity = matchTemplatePrefix(suffix, entities)
    if (entity !== undefined) {
      return entity
    }
  }

  return undefined
}

function matchChoiceSuffix(definitionName, sourceModule, prefixes) {
  for (const prefix of prefixes) {
    if (!definitionName.startsWith(prefix)) {
      continue
    }

    const suffix = definitionName.slice(prefix.length)

    for (const template of sourceModule.templateOrder) {
      if (!suffix.startsWith(template.name)) {
        continue
      }

      const afterTemplate = suffix.slice(template.name.length)
      const choice = matchTemplatePrefix(afterTemplate, template.choices)

      if (choice !== undefined) {
        return {
          kind: 'exact',
          span: choice.span,
          entrypointKind: prefix === '$$fHasExercise' ? 'exercise' : undefined,
          templateName: prefix === '$$fHasExercise' ? template.name : undefined,
          choiceName: prefix === '$$fHasExercise' ? choice.name : undefined,
        }
      }
    }
  }

  return undefined
}

function matchTemplatePrefix(value, entities) {
  let match

  for (const entity of valuesOfEntityCollection(entities)) {
    if (!value.startsWith(entity.name)) {
      continue
    }
    if (match === undefined || entity.name.length > match.name.length) {
      match = entity
    }
  }

  return match
}

function valuesOfEntityCollection(entities) {
  if (entities instanceof Map) {
    return [...entities.values()]
  }
  return entities
}

function stripScopeWrapper(definitionName) {
  const match = /^\$\$\$\$sc_(.+)_\d+$/.exec(definitionName)
  return match?.[1] ?? definitionName
}

function decodeGeneratedName(value) {
  return value.replace(/\$u([0-9a-fA-F]{4})/g, (_match, hex) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  )
}

function resolvePackageDirectory(workspaceRoot, packageDir, packageName) {
  if (packageDir) {
    return path.resolve(packageDir)
  }

  const matches = []
  walkDirectories(path.resolve(workspaceRoot), (directoryPath) => {
    const damlYamlPath = path.join(directoryPath, 'daml.yaml')
    if (!statExists(damlYamlPath, 'file')) {
      return
    }
    const parsed = parseDamlYaml(damlYamlPath)
    if (parsed.name === packageName) {
      matches.push(directoryPath)
    }
  })

  if (matches.length === 0) {
    throw new Error(`Could not find package '${packageName}' under ${workspaceRoot}`)
  }

  if (matches.length > 1) {
    throw new Error(`Found multiple package directories for '${packageName}': ${matches.join(', ')}`)
  }

  return matches[0]
}

function parseDamlYaml(filePath) {
  const text = readFileSync(filePath, 'utf8')
  const result = {
    name: '',
    source: 'daml',
  }

  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_-]+)\s*:\s*(.+)\s*$/.exec(line.trim())
    if (!match) {
      continue
    }
    const key = match[1]
    const value = stripYamlQuotes(match[2])

    if (key === 'name') {
      result.name = value
    } else if (key === 'source') {
      result.source = value
    }
  }

  if (!result.name) {
    throw new Error(`Could not read package name from ${filePath}`)
  }

  return result
}

async function collectImportedPackageIds(rawPackage, compiledPackage, allowedPackageIds) {
  const directImports =
    rawPackage.importsSum?.oneofKind === 'packageImports'
      ? [...rawPackage.importsSum.packageImports.importedPackages]
      : []

  if (directImports.length > 0) {
    return filterImportedPackages(directImports, allowedPackageIds)
  }

  const discoveredImports = new Set()
  const serializedPackage = JSON.stringify(compiledPackage)
  for (const match of serializedPackage.matchAll(/[0-9a-f]{64}/g)) {
    discoveredImports.add(match[0])
  }
  discoveredImports.delete(compiledPackage.packageId)
  return filterImportedPackages([...discoveredImports], allowedPackageIds)
}

async function collectWorkspacePackageIds(workspaceRoot, packageDir) {
  const sdk = await import('@distrohelena/canton-typescript-sdk/daml-lf')
  const archiveLoader = new sdk.DarArchiveLoader()
  const packageLoader = new sdk.DamlLfPackageLoader()
  const packageIds = new Set()
  const roots = packageDir ? [path.resolve(packageDir)] : [path.resolve(workspaceRoot)]

  for (const root of roots) {
    for (const darPath of findDarFiles(root)) {
      if (darPath.endsWith('-debug.dar')) {
        continue
      }

      try {
        const archive = await archiveLoader.loadDarOrThrowAsync(readFileSync(darPath))
        const compiledPackage = packageLoader.loadPackageOrThrow(archive.mainPackageEntry.bytes)
        packageIds.add(compiledPackage.packageId)
      } catch {
        // Ignore artifacts that are not package DARs we can index here.
      }
    }
  }

  return packageIds
}

function filterImportedPackages(importedPackages, allowedPackageIds) {
  const uniquePackageIds = [...new Set(importedPackages)]
  if (!allowedPackageIds || allowedPackageIds.size === 0) {
    return uniquePackageIds.sort()
  }

  return uniquePackageIds
    .filter((packageId) => allowedPackageIds.has(packageId))
    .sort()
}

function stripYamlQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  return value
}

function collectSourceModules(sourceDirectory, archiveSourcePrefix, workspaceRoot) {
  const modules = new Map()

  walkFiles(sourceDirectory, (filePath) => {
    if (!filePath.endsWith('.daml')) {
      return
    }

    const relativePath = path.relative(sourceDirectory, filePath)
    const archivePath = joinArchivePath(archiveSourcePrefix, relativePath)
    const sourceModule = parseSourceModule(
      readFileSync(filePath, 'utf8'),
      archivePath,
    )

    if (sourceModule !== undefined) {
      modules.set(sourceModule.moduleName, sourceModule)
    }
  })

  resolveInterfaceChoiceImplementations(
    modules,
    workspaceRoot ? collectWorkspaceInterfaces(workspaceRoot) : undefined,
  )

  return modules
}

function collectWorkspaceInterfaces(workspaceRoot) {
  const interfaces = new Map()

  walkFiles(path.resolve(workspaceRoot), (filePath) => {
    if (!filePath.endsWith('.daml')) {
      return
    }

    const sourceModule = parseSourceModule(readFileSync(filePath, 'utf8'), '')
    if (sourceModule === undefined) {
      return
    }

    for (const interfaceDefinition of sourceModule.interfaces.values()) {
      interfaces.set(interfaceDefinition.name, interfaceDefinition)
    }
  })

  return interfaces
}

function parseSourceModule(content, archivePath) {
  const lines = content.split(/\r?\n/)
  const topLevelLineIndexes = collectTopLevelLineIndexes(lines)
  const moduleLineIndex = lines.findIndex((line) => /^module\s+([A-Za-z0-9_.']+)\s+where\s*$/.test(line.trim()))

  if (moduleLineIndex < 0) {
    return undefined
  }

  const moduleName = lines[moduleLineIndex].trim().match(/^module\s+([A-Za-z0-9_.']+)\s+where\s*$/)?.[1]
  if (!moduleName) {
    return undefined
  }

  const moduleSpan = createSpan(lines, firstNonEmptyLine(lines), lastNonEmptyLine(lines))
  const values = new Map()
  const dataTypes = new Map()
  const interfaces = new Map()
  const interfaceInstances = []
  const templates = new Map()
  const templateOrder = []
  const typeOrder = []
  const pendingValueSignatures = new Map()

  for (let index = 0; index < topLevelLineIndexes.length; index += 1) {
    const startLineIndex = topLevelLineIndexes[index]
    const endLineIndex = findBlockEnd(lines, topLevelLineIndexes, index)
    const header = lines[startLineIndex].trim()

    if (header.startsWith('module ')) {
      continue
    }

    const dataMatch = /^data\s+([A-Z][A-Za-z0-9_']*)\b/.exec(header)
    if (dataMatch) {
      const fields = parseRecordFields(lines, startLineIndex, endLineIndex)
      const entity = {
        name: dataMatch[1],
        span: createSpan(lines, startLineIndex, endLineIndex),
        fields,
      }
      dataTypes.set(entity.name, entity)
      typeOrder.push(entity)
      continue
    }

    const interfaceMatch = /^interface\s+([A-Z][A-Za-z0-9_']*)\s+where\b/.exec(header)
    if (interfaceMatch) {
      interfaces.set(
        interfaceMatch[1],
        parseInterfaceDefinition(lines, startLineIndex, endLineIndex, interfaceMatch[1]),
      )
      continue
    }

    const templateMatch = /^template\s+([A-Z][A-Za-z0-9_']*)\b/.exec(header)
    if (templateMatch) {
      const fields = parseRecordFields(lines, startLineIndex, endLineIndex)
      const choices = parseTemplateChoices(lines, startLineIndex, endLineIndex)
      const templateInterfaceInstances = parseTemplateInterfaceInstances(
        lines,
        startLineIndex,
        endLineIndex,
        templateMatch[1],
      )
      const entity = {
        name: templateMatch[1],
        span: createSpan(lines, startLineIndex, endLineIndex),
        fields,
        choices,
      }
      templates.set(entity.name, entity)
      templateOrder.push(entity)
      typeOrder.push(entity)
      interfaceInstances.push(...templateInterfaceInstances)
      continue
    }

    const signatureMatch = /^([a-z][A-Za-z0-9_']*)\s*:/.exec(header)
    if (signatureMatch) {
      pendingValueSignatures.set(signatureMatch[1], startLineIndex)
      continue
    }

    const valueMatch = /^([a-z][A-Za-z0-9_']*)\b.*=/.exec(header)
    if (valueMatch && !isReservedTopLevelKeyword(valueMatch[1])) {
      const valueName = valueMatch[1]
      const valueStartLine = pendingValueSignatures.get(valueName) ?? startLineIndex
      values.set(valueName, createSpan(lines, valueStartLine, endLineIndex))
      pendingValueSignatures.delete(valueName)
    }
  }

  const templateOrDataEntities = [...templates.values(), ...dataTypes.values()]
  const templateOrDataEntityMap = new Map(templateOrDataEntities.map((entity) => [entity.name, entity]))

  return {
    moduleName,
    archivePath,
    moduleSpan,
    values,
    dataTypes,
    interfaces,
    interfaceInstances,
    templates,
    templateOrder,
    typeOrder,
    templateOrDataEntities,
    templateOrDataEntityMap,
    interfaceChoiceImplementations: [],
  }
}

function parseInterfaceDefinition(lines, startLineIndex, endLineIndex, interfaceName) {
  const choiceMethods = new Map()
  const choiceArgumentFieldNames = new Map()

  for (let lineIndex = startLineIndex + 1; lineIndex <= endLineIndex; lineIndex += 1) {
    const choiceMatch = /^\s*(?:nonconsuming\s+)?choice\s+([A-Z][A-Za-z0-9_']*)\s*:/.exec(lines[lineIndex])
    if (!choiceMatch) {
      continue
    }

    const choiceName = choiceMatch[1]
    const choiceEndLineIndex = findIndentedBlockEnd(lines, lineIndex, endLineIndex)

    for (let bodyLineIndex = lineIndex + 1; bodyLineIndex <= choiceEndLineIndex; bodyLineIndex += 1) {
      const argumentFieldMatch = /^\s+with\s+([a-z][A-Za-z0-9_']*)\s*:/.exec(lines[bodyLineIndex])
      if (argumentFieldMatch) {
        choiceArgumentFieldNames.set(choiceName, argumentFieldMatch[1])
      }

      const methodMatch = /\bdo\s+([a-z][A-Za-z0-9_']*)\s+this\s+self\b/.exec(lines[bodyLineIndex])
      if (methodMatch) {
        choiceMethods.set(methodMatch[1], choiceName)
        break
      }
    }
  }

  return {
    name: interfaceName,
    choiceMethods,
    choiceArgumentFieldNames,
  }
}

function parseRecordFields(lines, startLineIndex, endLineIndex) {
  const fields = new Map()
  let inWithBlock = false

  for (let lineIndex = startLineIndex + 1; lineIndex <= endLineIndex; lineIndex += 1) {
    const trimmed = lines[lineIndex].trim()
    if (trimmed === 'with') {
      inWithBlock = true
      continue
    }
    if (!inWithBlock) {
      continue
    }
    if (trimmed === 'where' || trimmed.startsWith('deriving')) {
      break
    }
    const fieldMatch = /^\s{2,}([a-z][A-Za-z0-9_']*)\s*:/.exec(lines[lineIndex])
    if (fieldMatch) {
      fields.set(fieldMatch[1], createSpan(lines, lineIndex, lineIndex))
    }
  }

  return fields
}

function parseTemplateChoices(lines, startLineIndex, endLineIndex) {
  const choices = new Map()

  for (let lineIndex = startLineIndex + 1; lineIndex <= endLineIndex; lineIndex += 1) {
    const choiceMatch = /^\s*(?:nonconsuming\s+)?choice\s+([A-Z][A-Za-z0-9_']*)\s*:/.exec(lines[lineIndex])
    if (choiceMatch) {
      choices.set(choiceMatch[1], {
        name: choiceMatch[1],
        span: createSpan(lines, lineIndex, findIndentedBlockEnd(lines, lineIndex, endLineIndex)),
      })
    }
  }

  return choices
}

function parseTemplateInterfaceInstances(lines, startLineIndex, endLineIndex, templateName) {
  const interfaceInstances = []

  for (let lineIndex = startLineIndex + 1; lineIndex <= endLineIndex; lineIndex += 1) {
    const instanceMatch =
      /^\s+interface instance\s+([A-Z][A-Za-z0-9_']*)\s+for\s+([A-Z][A-Za-z0-9_']*)\s+where\s*$/.exec(
        lines[lineIndex],
      )

    if (!instanceMatch || instanceMatch[2] !== templateName) {
      continue
    }

    const instanceEndLineIndex = findIndentedBlockEnd(lines, lineIndex, endLineIndex)
    const implementations = []

    for (
      let methodLineIndex = lineIndex + 1;
      methodLineIndex <= instanceEndLineIndex;
      methodLineIndex += 1
    ) {
      const methodMatch = /^\s+([a-z][A-Za-z0-9_']*)\b.*=/.exec(lines[methodLineIndex])
      if (!methodMatch || isReservedTopLevelKeyword(methodMatch[1])) {
        continue
      }

      implementations.push({
        methodName: methodMatch[1],
        span: createSpan(
          lines,
          methodLineIndex,
          findIndentedBlockEnd(lines, methodLineIndex, instanceEndLineIndex),
        ),
      })
    }

    interfaceInstances.push({
      interfaceName: instanceMatch[1],
      templateName,
      implementations,
    })
  }

  return interfaceInstances
}

function findIndentedBlockEnd(lines, startLineIndex, endLineIndex) {
  const startIndent = indentationWidth(lines[startLineIndex])
  let lastContentLine = startLineIndex

  for (let lineIndex = startLineIndex + 1; lineIndex <= endLineIndex; lineIndex += 1) {
    const line = lines[lineIndex]
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('--')) {
      continue
    }
    if (indentationWidth(line) <= startIndent) {
      break
    }
    lastContentLine = lineIndex
  }

  return lastContentLine
}

function resolveInterfaceChoiceImplementations(sourceModules, workspaceInterfaces) {
  const interfacesByName = workspaceInterfaces ?? new Map()

  if (workspaceInterfaces === undefined) {
    for (const sourceModule of sourceModules.values()) {
      for (const interfaceDefinition of sourceModule.interfaces.values()) {
        interfacesByName.set(interfaceDefinition.name, interfaceDefinition)
      }
    }
  }

  for (const sourceModule of sourceModules.values()) {
    sourceModule.interfaceChoiceImplementations = sourceModule.interfaceInstances.flatMap(
      (instance) => {
        const interfaceDefinition = interfacesByName.get(instance.interfaceName)
        if (interfaceDefinition === undefined) {
          return []
        }

        return instance.implementations.flatMap((implementation) => {
          const choiceName = interfaceDefinition.choiceMethods.get(implementation.methodName)
          if (choiceName === undefined) {
            return []
          }

          return [{
            templateName: instance.templateName,
            choiceName,
            choiceArgumentFieldName: interfaceDefinition.choiceArgumentFieldNames.get(choiceName),
            span: implementation.span,
          }]
        })
      },
    )
  }
}

function collectTopLevelLineIndexes(lines) {
  const indexes = []
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('--')) {
      continue
    }
    if (/^\S/.test(line)) {
      indexes.push(index)
    }
  }
  return indexes
}

function findBlockEnd(lines, topLevelLineIndexes, index) {
  const nextTopLevelLineIndex = topLevelLineIndexes[index + 1] ?? lines.length
  let endLineIndex = nextTopLevelLineIndex - 1

  while (endLineIndex > topLevelLineIndexes[index] && !lines[endLineIndex].trim()) {
    endLineIndex -= 1
  }

  return endLineIndex
}

function createSpan(lines, startLineIndex, endLineIndex) {
  return {
    startLine: startLineIndex + 1,
    startColumn: 1,
    endLine: endLineIndex + 1,
    endColumn: Math.max((lines[endLineIndex] ?? '').length + 1, 1),
  }
}

function firstNonEmptyLine(lines) {
  const index = lines.findIndex((line) => line.trim().length > 0)
  return index >= 0 ? index : 0
}

function lastNonEmptyLine(lines) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].trim().length > 0) {
      return index
    }
  }
  return 0
}

function isReservedTopLevelKeyword(value) {
  return new Set([
    'choice',
    'controller',
    'do',
    'ensure',
    'let',
    'observer',
    'signatory',
    'then',
    'where',
  ]).has(value)
}

function indentationWidth(line) {
  const match = /^(\s*)/.exec(line)
  return match?.[1].length ?? 0
}

function statExists(candidatePath, kind) {
  try {
    const stats = statSync(path.resolve(candidatePath))
    return kind === 'file' ? stats.isFile() : stats.isDirectory()
  } catch {
    return false
  }
}

function walkDirectories(rootDir, visitor) {
  visitor(rootDir)
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }
    const absolutePath = path.join(rootDir, entry.name)
    walkDirectories(absolutePath, visitor)
  }
}

function walkFiles(rootDir, visitor) {
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const absolutePath = path.join(rootDir, entry.name)
    if (entry.isDirectory()) {
      walkFiles(absolutePath, visitor)
      continue
    }
    if (entry.isFile()) {
      visitor(absolutePath)
    }
  }
}

function findDarFiles(rootDir) {
  const files = []
  walkFiles(rootDir, (filePath) => {
    if (filePath.endsWith('.dar')) {
      files.push(filePath)
    }
  })
  return files.sort()
}

function joinArchivePath(prefix, relativePath) {
  const normalizedRelativePath = normalizeArchivePath(relativePath)
  if (!prefix) {
    return normalizedRelativePath
  }
  return `${normalizeArchivePath(prefix)}/${normalizedRelativePath}`
}

function normalizeArchivePath(value) {
  return value
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/')
}

function defaultOutputPath(inputDar) {
  const extension = path.extname(inputDar)
  const baseName = extension ? inputDar.slice(0, -extension.length) : inputDar
  return `${baseName}-source-map.json`
}

function requireValue(argv, index, flagName) {
  const value = argv[index]
  if (!value) {
    throw new Error(`${flagName} requires a value`)
  }
  return value
}

function printHelp() {
  console.log(`Usage:
  node ./scripts/generate-daml-source-map.mjs \\
    --input /path/to/package.dar \\
    --workspace-root /path/to/daml/workspace \\
    [--package-dir /path/to/specific/package] \\
    [--source-prefix daml] \\
    [--debug-dalf /path/to/location-preserving.dalf] \\
    [--workspace-imports-only] \\
    [--output /path/to/source-map.json]

Notes:
  - The script reads the compiled main package from the DAR.
  - If --debug-dalf is provided, or the DAR already contains debug/*.dalf, the
    script emits deterministic expressionLocations from compiler-authored LF
    source spans.
  - It resolves the matching DAML package directory from daml.yaml.
  - It emits debug/source-map-compatible metadata for the main package.
  - --workspace-imports-only limits importedPackages to package ids built from
    the same workspace, so replay does not recurse into stdlib/vendor DARs.
  - Compiler-generated helper definitions fall back to the surrounding module span
    when a more specific source span cannot be inferred.`)
}

await main()
