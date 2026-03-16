/**
 * TODO: Move this into the SDK
 */

import utils from '@eventcatalog/sdk';

export const getMessageTypeUtils = (projectDirectory: string, messageType: string) => {
  const {
    writeEvent,
    versionCommand,
    getEvent,
    getCommand,
    rmCommandById,
    rmEventById,
    writeCommand,
    addFileToCommand,
    addFileToEvent,
    versionEvent,
    versionQuery,
    getQuery,
    rmQueryById,
    writeQuery,
    addFileToQuery,
    addExampleToEvent,
    addExampleToCommand,
    addExampleToQuery,
  } = utils(projectDirectory);

  const messageTypeMap: { [key: string]: any } = {
    event: {
      versionMessage: versionEvent,
      getMessage: getEvent,
      rmMessageById: rmEventById,
      writeMessage: writeEvent,
      addFileToMessage: addFileToEvent,
      addExampleToMessage: addExampleToEvent,
      collection: 'events',
    },
    command: {
      versionMessage: versionCommand,
      getMessage: getCommand,
      rmMessageById: rmCommandById,
      writeMessage: writeCommand,
      addFileToMessage: addFileToCommand,
      addExampleToMessage: addExampleToCommand,
      collection: 'commands',
    },
    query: {
      versionMessage: versionQuery,
      getMessage: getQuery,
      rmMessageById: rmQueryById,
      writeMessage: writeQuery,
      addFileToMessage: addFileToQuery,
      addExampleToMessage: addExampleToQuery,
      collection: 'queries',
    },
  };

  return messageTypeMap[messageType] || messageTypeMap.query;
};
