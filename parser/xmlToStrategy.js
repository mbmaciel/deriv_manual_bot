const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

// Mapeamento de variáveis em português para inglês
const VARIABLE_MAPPING = {
  'VALOR INICIAL': 'stake',
  'PREVISÃO': 'prediction',
  'MARTINGALE': 'martingale',
  'META': 'takeProfit',
  'META DE LUCRO': 'takeProfit',
  'META DE GANHO': 'takeProfit',
  'LIMITE DE GANHOS': 'takeProfit',
  'LIMITE DE PERDA': 'stopLoss',
  'USAR MARTINGALE APÓS QUANTOS LOSS?': 'lossCountLimit',
  'VALOR APÓS VENCER': 'stakeAfterWin',
  'PREÇO FIXO INICIAL': 'stake',
  'PREÇO': 'stake',
  'LIMITE DE MARTINGALE': 'maxMartingaleLevel',
  'TOTAL DE MARTINGALE': 'currentMartingaleLevel',
  'FILTRAR MELHOR CONDIÇÃO': 'filterCondition',
  'DIREÇÃO': 'direction',
  'CONTADOR DE LOSS': 'lossCount',
  'LISTA DE TICKS': 'ticksList',
  'MAX': 'maxValue',
  'MIN': 'minValue',
  'PARCELAS DE MARTINGALE': 'martingaleParts',
  'CONTADOR DE WINS': 'winCount',
  'CONTADOR DE LOSS VIRTUAL': 'virtualLossCount',
  'LOSS VIRTUAL': 'virtualLoss',
  // Variáveis específicas da estratégia advance
  'PORCENTAGEM PARA ENTRAR': 'entryPercentage',
  'NUM 0': 'num0Count',
  'NUM 1': 'num1Count',
  'LISTA DE DIGITOS': 'digitsList'
};

// Recursivamente busca o primeiro bloco do tipo 'variables_set'
function findFirstInitializationBlock(node) {
  if (!node) return null;

  if (typeof node === 'object') {
    if (node.type === 'variables_set') return node;

    for (const key in node) {
      const found = findFirstInitializationBlock(node[key]);
      if (found) return found;
    }
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findFirstInitializationBlock(item);
      if (found) return found;
    }
  }

  return null;
}

// Caminha pelos blocos conectados por 'next' e extrai as variáveis
function extractVariables(block) {
  const vars = {};
  let current = block;

  while (current) {
    try {
      // Extrair nome da variável - pode estar em diferentes estruturas
      let name = null;
      if (current.field) {
        if (Array.isArray(current.field)) {
          const varField = current.field.find(f => f.name === 'VAR');
          name = varField ? varField['#text'] : null;
        } else if (current.field['#text']) {
          name = current.field['#text'];
        }
      }
      
      // Extrair valor da variável
      let value = null;
      if (current.value?.block) {
        const valueBlock = current.value.block;
        
        // Verificar se é um valor numérico direto
        if (valueBlock.field && !isNaN(parseFloat(valueBlock.field))) {
          value = parseFloat(valueBlock.field);
        }
        // Verificar se é um valor numérico em NUM (estrutura com name="NUM")
        else if (valueBlock.field?.name === 'NUM' && valueBlock.field['#text'] !== undefined) {
          value = parseFloat(valueBlock.field['#text']);
        }
        // Verificar se é um valor numérico em NUM (estrutura antiga)
        else if (valueBlock.field?.NUM && !isNaN(parseFloat(valueBlock.field.NUM))) {
          value = parseFloat(valueBlock.field.NUM);
        }
        // Verificar se é um valor de texto
        else if (valueBlock.field?.TEXT) {
          value = valueBlock.field.TEXT;
        }
        // Verificar se é uma referência a outra variável
        else if (valueBlock.field?.['#text']) {
          const referencedVar = valueBlock.field['#text'];
          if (vars[referencedVar] !== undefined) {
            value = vars[referencedVar];
          }
        }
      }
      
      if (name && value !== null) {
        vars[name] = value;
      }
      
      current = current.next?.block;
    } catch (error) {
      console.warn(`⚠️ Aviso: Erro ao extrair variável: ${error.message}`);
      current = current.next?.block;
    }
  }

  return vars;
}

// Extrai informações de mercado e tipo de contrato
function extractMarketInfo(root) {
  try {
    // Procurar pelo bloco 'trade'
    const tradeBlock = findBlockByType(root, 'trade');
    if (!tradeBlock) return {};
    
    // Extrair informações do mercado
    const marketInfo = {
      market: findFieldValue(tradeBlock, 'MARKET_LIST') || 'synthetic_index',
      submarket: findFieldValue(tradeBlock, 'SUBMARKET_LIST') || 'random_index',
      symbol: findFieldValue(tradeBlock, 'SYMBOL_LIST') || 'R_100',
      contractType: findFieldValue(tradeBlock, 'TRADETYPE_LIST') || 'overunder',
      contractTypeCategory: findFieldValue(tradeBlock, 'TYPE_LIST') || 'DIGITUNDER',
      candleInterval: parseInt(findFieldValue(tradeBlock, 'CANDLEINTERVAL_LIST') || '60'),
      duration: 1,
      duration_unit: 't'
    };
    
    // Procurar pelo bloco 'before_purchase' para extrair o tipo de contrato específico
    const beforePurchaseBlock = findBlockByType(root, 'before_purchase');
    if (beforePurchaseBlock && beforePurchaseBlock.statement && beforePurchaseBlock.statement.block) {
      const purchaseBlock = beforePurchaseBlock.statement.block;
      if (purchaseBlock && purchaseBlock.type === 'purchase' && purchaseBlock.field) {
        const purchaseListField = Array.isArray(purchaseBlock.field) 
          ? purchaseBlock.field.find(f => f.name === 'PURCHASE_LIST')
          : purchaseBlock.field.name === 'PURCHASE_LIST' ? purchaseBlock.field : null;
        
        if (purchaseListField) {
          marketInfo.contractTypeCategory = purchaseListField['#text'] || purchaseListField;
        }
      }
    }
    
    // Procurar pelo bloco 'tradeOptions' para extrair duração e previsão
    if (tradeBlock.statement && Array.isArray(tradeBlock.statement)) {
      const submarketStatement = tradeBlock.statement.find(s => s.name === 'SUBMARKET');
      if (submarketStatement && submarketStatement.block) {
        const tradeOptionsBlock = submarketStatement.block;
        if (tradeOptionsBlock && tradeOptionsBlock.type === 'tradeOptions') {
          // Extrair duração
          if (tradeOptionsBlock.value && Array.isArray(tradeOptionsBlock.value)) {
            const durationValue = tradeOptionsBlock.value.find(v => v.name === 'DURATION');
            if (durationValue && durationValue.block && durationValue.block.field) {
              marketInfo.duration = parseInt(durationValue.block.field);
            }
            
            // Extrair previsão (barrier)
            const predictionValue = tradeOptionsBlock.value.find(v => v.name === 'PREDICTION');
            if (predictionValue && predictionValue.shadow && predictionValue.shadow.field) {
              marketInfo.prediction = parseInt(predictionValue.shadow.field);
            }
          }
          
          // Extrair unidade de duração
          if (tradeOptionsBlock.field && Array.isArray(tradeOptionsBlock.field)) {
            const durationTypeField = tradeOptionsBlock.field.find(f => f.name === 'DURATIONTYPE_LIST');
            if (durationTypeField) {
              marketInfo.duration_unit = durationTypeField['#text'];
            }
          }
        }
      }
    }
    
    return marketInfo;
  } catch (error) {
    console.warn('⚠️ Aviso: Não foi possível extrair informações de mercado do XML:', error.message);
    return {};
  }
}

// Função auxiliar para encontrar o valor de um campo em um bloco
function findFieldValue(block, fieldName) {
  if (!block || !block.field || !Array.isArray(block.field)) return null;
  
  const field = block.field.find(f => f.name === fieldName);
  return field ? field['#text'] : null;
}

// Extrai informações sobre o martingale
function extractMartingaleInfo(root) {
  try {
    // Procurar por blocos de matemática com operação MULTIPLY em qualquer lugar do XML
    const mathBlocks = findAllBlocksByType(root, 'math_arithmetic')
      .filter(block => {
        if (!block.field) return false;
        if (Array.isArray(block.field)) {
          return block.field.some(f => f['#text'] === 'MULTIPLY');
        } else {
          return block.field['#text'] === 'MULTIPLY';
        }
      });
    
    let martingaleFactor = 2; // Valor padrão
    
    if (mathBlocks.length > 0) {
      // Procurar por blocos que multiplicam o preço
      for (const mathBlock of mathBlocks) {
        // Verificar se este bloco está sendo usado para calcular o martingale
        let isMartigaleCalc = false;
        
        // Verificar se o primeiro operando é uma variável de preço
        if (mathBlock.value && Array.isArray(mathBlock.value)) {
          const valueA = mathBlock.value.find(v => v.name === 'A');
          if (valueA && valueA.block && valueA.block.type === 'variables_get') {
            const varName = valueA.block.field && valueA.block.field['#text'];
            if (varName === 'PREÇO' || varName === 'Preço' || varName === 'm03mC1E%O+o|Am!^g|^#') {
              isMartigaleCalc = true;
            }
          }
        }
        
        // Se for um cálculo de martingale, pegar o fator
        if (isMartigaleCalc) {
          const valueB = mathBlock.value && mathBlock.value.find(v => v.name === 'B');
          if (valueB && valueB.shadow && valueB.shadow.field) {
            const factor = parseFloat(valueB.shadow.field);
            if (!isNaN(factor)) {
              martingaleFactor = factor;
              break;
            }
          }
        }
      }
    }
    
    return { martingaleFactor };
  } catch (error) {
    console.warn('⚠️ Aviso: Não foi possível extrair informações de martingale:', error.message);
    return { martingaleFactor: 2 };
  }
}

// Função auxiliar para encontrar um bloco por tipo
function findBlockByType(node, type) {
  if (!node) return null;

  if (typeof node === 'object') {
    if (node.type === type) return node;

    for (const key in node) {
      const found = findBlockByType(node[key], type);
      if (found) return found;
    }
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findBlockByType(item, type);
      if (found) return found;
    }
  }

  return null;
}

// Função auxiliar para encontrar todos os blocos de um determinado tipo
function findAllBlocksByType(node, type, results = []) {
  if (!node) return results;

  if (typeof node === 'object') {
    if (node.type === type) {
      results.push(node);
    }

    for (const key in node) {
      if (key !== 'parent') { // Evitar loops infinitos
        findAllBlocksByType(node[key], type, results);
      }
    }
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      findAllBlocksByType(item, type, results);
    }
  }

  return results;
}

// Função para mapear variáveis em português para inglês
function mapVariables(variables) {
  const mappedVars = {};
  
  for (const [key, value] of Object.entries(variables)) {
    const mappedKey = VARIABLE_MAPPING[key] || key;
    mappedVars[mappedKey] = value;
  }
  
  return mappedVars;
}

function parseXmlStrategy(xmlPath) {
  // Verificar se o caminho é absoluto ou relativo
  const fullPath = path.isAbsolute(xmlPath) ? xmlPath : path.resolve(process.cwd(), xmlPath);
  
  // Verificar se o arquivo existe
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Arquivo de estratégia não encontrado: ${fullPath}`);
  }
  
  // Extrair o nome da estratégia do nome do arquivo
  const strategyName = path.basename(fullPath, '.xml');
  
  console.log(`📄 Carregando estratégia: ${strategyName}`);
  const xml = fs.readFileSync(fullPath, 'utf8');
  
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    allowBooleanAttributes: true,
    parseAttributeValue: true
  });

  const json = parser.parse(xml);

  const root = json.xml?.block;
  if (!root) throw new Error('Arquivo XML inválido: não encontrou blocos.');

  const initBlock = findFirstInitializationBlock(root);
  if (!initBlock) throw new Error("Bloco de inicialização 'variables_set' não encontrado.");

  // Extrair e mapear variáveis
  const rawVariables = extractVariables(initBlock);
  const variables = mapVariables(rawVariables);
  
  // Extrair informações de mercado e martingale
  const marketInfo = extractMarketInfo(root);
  const martingaleInfo = extractMartingaleInfo(root);

  // Detectar estratégias especiais
  const isAdvanceStrategy = strategyName === 'advance' && variables.entryPercentage !== undefined;
  const isMaxproStrategy = strategyName === 'maxpro' && variables.virtualLoss !== undefined;
  

  
  // Criar objeto de estratégia com valores padrão para campos ausentes
  const strategy = {
    name: strategyName,
    stake: variables.stake ?? 5,
    prediction: (marketInfo.prediction && !isNaN(marketInfo.prediction)) ? marketInfo.prediction : 
               (variables.prediction && !isNaN(variables.prediction)) ? variables.prediction : 1,
    martingale: variables.martingale ?? (martingaleInfo.martingaleFactor - 1),
    martingaleFactor: variables.martingale ?? martingaleInfo.martingaleFactor,
    takeProfit: variables.takeProfit ?? 10,
    stopLoss: variables.stopLoss ?? 100,
    lossCountLimit: variables.lossCountLimit ?? 1,
    maxMartingaleLevel: variables.maxMartingaleLevel ?? 9,
    stakeAfterWin: variables.stakeAfterWin ?? variables.stake ?? 5,
    filterCondition: variables.filterCondition,
    market: marketInfo.market || 'synthetic_index',
    submarket: marketInfo.submarket || 'random_index',
    symbol: marketInfo.symbol || 'R_100',
    contractType: marketInfo.contractType || 'overunder',
    contractTypeCategory: marketInfo.contractTypeCategory || 'DIGITOVER',
    candleInterval: marketInfo.candleInterval || 60,
    duration: (marketInfo.duration && !isNaN(marketInfo.duration)) ? marketInfo.duration : 1,
    duration_unit: marketInfo.duration_unit || 't',
    // Propriedades específicas da estratégia advance
    isAdvanceStrategy: isAdvanceStrategy,
    entryPercentage: variables.entryPercentage ?? 8,
    martingaleParts: variables.martingaleParts ?? 2,
    // Propriedades específicas da estratégia maxpro
    isMaxproStrategy: isMaxproStrategy,
    virtualLoss: variables.virtualLoss ?? 1,
    virtualLossCount: variables.virtualLossCount ?? 0
  };

  console.log('📊 Parâmetros da estratégia:');
  console.log(`   - Nome: ${strategy.name}`);
  console.log(`   - Valor inicial: ${strategy.stake}`);
  console.log(`   - Previsão: ${strategy.prediction}`);
  console.log(`   - Martingale: ${strategy.martingaleFactor}x (fator ${strategy.martingale + 1})`);
  console.log(`   - Meta de lucro: ${strategy.takeProfit}`);
  console.log(`   - Limite de perda: ${strategy.stopLoss}`);
  console.log(`   - Limite de níveis martingale: ${strategy.maxMartingaleLevel}`);
  console.log(`   - Usar martingale após: ${strategy.lossCountLimit} loss(es)`);
  console.log(`   - Mercado: ${strategy.market}/${strategy.submarket}/${strategy.symbol}`);
  console.log(`   - Tipo de contrato: ${strategy.contractTypeCategory}`);
  console.log(`   - Duração: ${strategy.duration} ${strategy.duration_unit}`);
  
  if (strategy.filterCondition) {
    console.log(`   - Condição de filtro: ${strategy.filterCondition}`);
  }

  return strategy;
}

module.exports = { parseXmlStrategy };