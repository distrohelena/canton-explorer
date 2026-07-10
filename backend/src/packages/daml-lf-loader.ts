import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import protobuf, { Root } from 'protobufjs';
import descriptor from 'protobufjs/ext/descriptor';

let valueRoot: Root | null = null;
const rootFromDescriptor = (
  protobuf.Root as typeof protobuf.Root & {
    fromDescriptor(descriptorSet: unknown): Root;
  }
).fromDescriptor;

export function loadValueRoot(): Root {
  if (!valueRoot) {
    const emptyDescriptor = descriptor.FileDescriptorProto.create({
      name: 'google/protobuf/empty.proto',
      package: 'google.protobuf',
      messageType: [descriptor.DescriptorProto.create({ name: 'Empty' })],
      syntax: 'proto3',
    });
    valueRoot = rootFromDescriptor(
      descriptor.FileDescriptorSet.create({
        file: [emptyDescriptor, loadDescriptorFile('daml-lf-value.descriptor.pb')],
      }),
    );
  }

  return valueRoot;
}

function loadDescriptorFile(filename: string) {
  const filePath = resolveDescriptorPath(filename);
  return descriptor.FileDescriptorProto.decode(
    readFileSync(filePath),
  );
}

export function resolveDescriptorPath(filename: string, baseDir = __dirname): string {
  const directPath = resolve(baseDir, filename);
  if (existsSync(directPath)) {
    return directPath;
  }

  const packagedPath = resolve(baseDir, '..', '..', 'packages', filename);
  if (existsSync(packagedPath)) {
    return packagedPath;
  }

  const legacyPackagedPath = resolve(baseDir, '..', '..', 'packages', 'packages', filename);
  if (existsSync(legacyPackagedPath)) {
    return legacyPackagedPath;
  }

  const sourcePath = resolve(process.cwd(), 'src', 'packages', filename);
  if (existsSync(sourcePath)) {
    return sourcePath;
  }

  return directPath;
}
