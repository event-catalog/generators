import { AsyncAPIDocumentInterface, ChannelInterface } from '@asyncapi/parser';

export const getChannelProtocols = (channel: ChannelInterface): string[] => {
  const protocols = new Set<string>();

  const bindings = channel.bindings();
  for (const binding of bindings) {
    protocols.add(binding.protocol());
  }

  const servers = channel.servers();
  for (const server of servers) {
    protocols.add(server.protocol());
  }

  return Array.from(protocols);
};

export const getChannelTags = (channel: ChannelInterface): string[] => {
  const tags: string[] = [];
  const jsonTags = channel.json()?.tags;

  if (Array.isArray(jsonTags)) {
    for (const tag of jsonTags) {
      if (tag.name && !tags.includes(tag.name)) {
        tags.push(tag.name);
      }
    }
  }

  return tags;
};

export const defaultMarkdown = (_document: AsyncAPIDocumentInterface, channel: ChannelInterface) => {
  return `
  ${
    channel.hasDescription()
      ? `
  ## Overview
  ${channel.description()}
  `
      : ''
  }

  <ChannelInformation />

  ${
    channel.json()?.externalDocs
      ? `
  ## External documentation
  - [${channel.json()?.externalDocs?.description}](${channel.json()?.externalDocs?.url})
  `
      : ''
  }
  
  `;
};
