const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();
const API_KEY = SCRIPT_PROPERTIES.getProperty('apiKey')
const FOLDER_ID = '1uQwm3gYg2tDQQjSO8LI9amuox2B6GGP2';
const MAIN_BASE_ID = "appGB8pNef4k4V0e2";
const CP_BASE_ID = "appy5dq50chEn7fBE";
const MAIN_BASE_TABLES = retrieveBaseSchema(MAIN_BASE_ID);
const CP_BASE_TABLES = retrieveBaseSchema(CP_BASE_ID);

let folder;
let files;

function loadFiles() {
  folder = DriveApp.getFolderById(FOLDER_ID);
  files = folder.getFiles();
}

function getZapJSON(file) {
    const content = file.getBlob().getDataAsString();
    const json = JSON.parse(content);
    return json.zaps;
}

function testRetrieveBaseSchema() {
  const data = retrieveBaseSchema(MAIN_BASE_ID);
  Logger.log(data);
}

function retrieveBaseSchema(baseId) {
  const url = `https://api.airtable.com/v0/meta/bases/${baseId}/tables`;
  const options = {
    headers: {
      Authorization: `Bearer ${API_KEY}`
    },
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (statusCode !== 200) {
      throw new Error("Respuesta no exitosa de Airtable: " + statusCode + " - " + responseBody);
    }

    const data = JSON.parse(responseBody);

    return data;
  }
  catch(e) {
    Logger.log("Error conectando con el API: " + e);
    return null;
  }
}

function testRetrieveFieldName() {
  const fieldName = retrieveFieldName("appGB8pNef4k4V0e2", "tblHuZp0rPISUU2Zq", "fldh87K2sSM8vnXLT");
  Logger.log(fieldName);
}

function retrieveFieldName(baseId, tableId, fieldId) {
  try {
    let baseTables;

    if (baseId == MAIN_BASE_ID) {
      baseTables = MAIN_BASE_TABLES;
    }
    else {
      baseTables = CP_BASE_TABLES;
    }

    if (!baseTables.tables) {
      throw new Error("Propiedad 'tables' no encontrada en respuesta");
    }

    const tablas = baseTables.tables;
    const tablaCorrecta = tablas.find((tabla) => tabla.id === tableId);
    if (!tablaCorrecta) throw new Error("Tabla no encontrada");

    const campoCorrecto = tablaCorrecta.fields.find((field) => field.id === fieldId);
    if (!campoCorrecto) throw new Error("Campo no encontrado");
    return campoCorrecto.name || null;


  } catch (e) {
    Logger.log("Error recuperando campos de Airtable: " + e);
    return null;
  }
}

function findFilterAndSearchFields(parammap, tablas, tableKey, zapName) {
  const fieldsContainingColName = ["filterByField", "searchByField"];

  Object.keys(parammap).forEach(field => {
    if (fieldsContainingColName.includes(field)) {
      const fieldName = parammap[field];
      if (fieldName) {
        const existing = tablas[tableKey].fields.find(f => f.name === fieldName);
        if (!existing) {
          tablas[tableKey].fields.push({ id: null, name: fieldName, usedInZaps: [zapName] });
        }
        else {
          if (!existing.usedInZaps.includes(zapName)) {
            existing.usedInZaps.push(zapName);
          }
        }
      }
    }
  });
}

function findReadWriteFields(params, tablas, tableKey, baseId, tableId, zapName) {
  for (const paramsKey in params) {
    if (!paramsKey.startsWith("fields__")) continue;
    const value = params[paramsKey];
    if (!value || value.trim() === "") continue;
    const fieldId = paramsKey.replace("fields__", "");
    const fieldName = retrieveFieldName(baseId, tableId, fieldId);

    if (fieldName) {
      const existing = tablas[tableKey].fields.find(f => f.id === fieldId);
      if (!existing) {
        tablas[tableKey].fields.push({
          id: fieldId,
          name: fieldName,
          usedInZaps: [zapName]
        });
      }
      else {
        if (!existing.usedInZaps.includes(zapName)) {
          existing.usedInZaps.push(zapName);
        }
      }
    }
  }
}

function testFindAllParams() {
  const params = {
    "input": {
      "mgrContactEmail": "{{2__fields__Primary Contact Email}}",
      "boardContactEmail": "{{2__fields__Board Contact Email}}",
      "accountingContactEmail": "{{2__fields__Accounting Contact Email}}",
      "mgrContactFullName": "{{2__fields__Primary Contact}}",
      "boardContactFullName": "{{2__fields__Board Contact Name}}",
      "accountingContactFullName": "{{2__fields__Accounting Contact Name}}",
      "mgrContactRecID": "{{2__fields__Manager Contact}}",
      "boardContactRecID": "{{2__fields__Board Contact}}",
      "accountingContactRecID": "{{2__fields__Accounting Contact}}",
      "hasCDMaturing": "{{2__fields__Has CD Maturing <= Max Days until CD Maturity}}",
      "alertMode": "{{2__fields__Send Alerts (from Global) (from Mgt Co)}}",
      "qcContactName": "{{2__fields__Name (from QC Contact)}}",
      "qcContactEmail": "{{2__fields__Email (from QC Contact)}}",
      "treasurerContactFullName": "{{2__fields__Board Treasurer Name}}",
      "treasurerContactEmail": "{{2__fields__Board Treasurer Email}}",
      "treasurerContactRecID": "{{2__fields__Board Treasurer}}"
    }
  };
  let tablas = {
    "test": {
      base_id: "baseId",
      table: "tableName",
      fields: []
    }
  };
  let zapName = "Analysis Notification";
  let stepDict = {
    2: {
      "tableKey": "appGB8pNef4k4V0e2|Communities"
    }
  }
  findAllParams(params, tablas, zapName, stepDict);
}

function findAllParams(params, tablas, zapName, stepKeyDict) {
  const paramsStr = JSON.stringify(params);
  const matches = [...paramsStr.matchAll(/{{(.*?)}}/g)].map(match => match[1].trim());
  const cleaned = matches
    .filter(str => str.includes("__fields__"))
    .map(str => {
      const idx = str.indexOf("fields__");
      const fieldName = str.substring(idx + "fields__".length).trim();
      const fromStep = parseInt(str.split("__")[0]);
      const tableKey = stepKeyDict[fromStep].tableKey;
      return {name: fieldName, tableKey: tableKey}
    });
  cleaned.forEach((campo) => {
    const existing = tablas[campo.tableKey].fields.find(f => f.name === campo.name);
    if (!existing) {
      tablas[campo.tableKey].fields.push({
        id: null,
        name: campo.name,
        usedInZaps: [zapName]
      });
    }
    else {
      if (!existing.usedInZaps.includes(zapName)) {
        existing.usedInZaps.push(zapName);
      }
    }
  })
}


function createOutput(json) {
  const currDate = new Date().toISOString();
  const jsonOutput = JSON.stringify(json, null, 2);
  const outputFile = DriveApp.createFile(`${currDate}_airtable_fields.json`, jsonOutput, MimeType.PLAIN_TEXT);
  return outputFile;
}

function createZapMap (tablas){
  let zapMap = {}
 for (let tabla of Object.values(tablas)) {
  let tableName = tabla.table
  let baseId = tabla.base_id

  tabla.fields.forEach(field => {
    field.usedInZaps.forEach(zap => {
      if (!zapMap[zap]) zapMap[zap] = [];
      zapMap[zap].push({
        id: field.id,
        name: field.name,
        tableName: tableName,
        baseId: baseId
      });
    });
});
 }
 return zapMap;
}



function findActiveFields() {
  try {
    loadFiles();
  } catch(e) {
    Logger.log("Error loading files.");
  }

  let tablas = {};

  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();

    if (!fileName.endsWith('.json')) continue;

    let zaps;

    try {
      zaps = getZapJSON(file);
    } catch(e) {
      Logger.log("Error Retrieving Zap JSON")
    }
    
    if (!Array.isArray(zaps) || zaps.length === 0) {
      continue;
    }

    const zapName = zaps[0].title;
    const nodesObj = zaps[0].nodes;

    if (!nodesObj || typeof nodesObj !== 'object') {
      continue;
    }

    let airtableStepKeyDict = {};

    for (const nodeId in nodesObj) {
      const node = nodesObj[nodeId];

      const selectedApi = node?.selected_api || '';
      const parammap = node?.meta?.parammap;
      const params = node?.params;

      let baseId = "";
      let tableId = "";
      let tableName = "";
      let tableKey = "";

      // the step is an Airtable step
      if (selectedApi.toLowerCase().includes('airtable')) {
        baseId = params.applicationId || 'UnknownTable';
        tableId = params.tableName || "UnknownTable";
        tableName = parammap.tableName || 'UnknownTable';
        tableKey = baseId + '|' + tableName;

        airtableStepKeyDict[node.id] = {
          "baseId": baseId,
          "tableId": tableId,
          "tableName": tableName,
          "tableKey": tableKey
        }

        if (!tablas[tableKey]) {
          tablas[tableKey] = {
            base_id: baseId,
            table: tableName,
            fields: []
          };
        }

        findFilterAndSearchFields(parammap, tablas, tableKey, zapName);
        findReadWriteFields(params, tablas, tableKey, baseId, tableId, zapName);
      }
      // the step is NOT an Airtable step
      else {
        findAllParams(params, tablas, zapName, airtableStepKeyDict);
      }
    }
  }

  const resultado = Object.values(tablas).map(tabla => ({
    base_id: tabla.base_id,
    table: tabla.table,
    fields: Array.from(tabla.fields)
  }));

  const zapMap = createZapMap(tablas);

  let outputFile1;
  let outputFile2;
  try {
    outputFile1 = createOutput(resultado);
    outputFile2 = createOutput(zapMap);
  } catch(e) {
    Logger.log("Error creating output file.");
  }
  const fileUrl1 = outputFile1.getUrl();
  const fileUrl2 = outputFile2.getUrl();
  Logger.log(`Successfully generated output1: ${fileUrl1}\n
              Successfully generated output2: ${fileUrl2}`)
}

