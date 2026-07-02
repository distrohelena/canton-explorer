import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import protobuf, { Root } from 'protobufjs';
import descriptor from 'protobufjs/ext/descriptor';

let archiveRoot: Root | null = null;
let valueRoot: Root | null = null;
const rootFromDescriptor = (
  protobuf.Root as typeof protobuf.Root & {
    fromDescriptor(descriptorSet: unknown): Root;
  }
).fromDescriptor;

export function loadArchiveRoot(): Root {
  if (!archiveRoot) {
    archiveRoot = rootFromDescriptor(
      descriptor.FileDescriptorSet.create({
        file: [
          loadDescriptorFile('daml-lf-archive-v2.descriptor.pb'),
          loadDescriptorFile('daml-lf-archive.descriptor.pb'),
        ],
      }),
    );
  }

  return archiveRoot;
}

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

function resolveDescriptorPath(filename: string): string {
  const directPath = resolve(__dirname, filename);
  if (existsSync(directPath)) {
    return directPath;
  }

  const sourcePath = resolve(__dirname, '..', '..', 'src', 'packages', filename);
  if (existsSync(sourcePath)) {
    return sourcePath;
  }

  return directPath;
}
