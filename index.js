require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { parseXmlStrategy } = require('./parser/xmlToStrategy');
const { connect } = require('./deriv/client');
const { executeStrategy } = require('./strategy/executor');

// Diretório onde as estratégias estão armazenadas
const STRATEGIES_DIR = './strategies';

// Verificar se o arquivo .env existe e tem o token
if (!process.env.DERIV_TOKEN) {
  console.error('❌ ERRO: Token da Deriv não encontrado no arquivo .env');
  console.error('Por favor, crie um arquivo .env com DERIV_TOKEN=seu_token_aqui');
  process.exit(1);
}

// Verificar se o diretório de estratégias existe
if (!fs.existsSync(STRATEGIES_DIR)) {
  console.error(`❌ ERRO: Diretório ${STRATEGIES_DIR} não encontrado`);
  console.error('Por favor, crie o diretório de estratégias');
  process.exit(1);
}

// Função para listar as estratégias disponíveis
function listStrategies() {
  try {
    const files = fs.readdirSync(STRATEGIES_DIR)
      .filter(file => file.endsWith('.xml'))
      .map(file => file);
    
    if (files.length === 0) {
      console.error('❌ ERRO: Nenhuma estratégia XML encontrada no diretório strategies');
      process.exit(1);
    }
    
    return files;
  } catch (error) {
    console.error('❌ ERRO ao listar estratégias:', error.message);
    process.exit(1);
  }
}

// Função para selecionar uma estratégia via linha de comando
async function selectStrategy() {
  // Verificar se foi passado um argumento de linha de comando
  const cmdArg = process.argv[2];
  if (cmdArg) {
    const strategyPath = cmdArg.includes('/') ? cmdArg : path.join(STRATEGIES_DIR, cmdArg);
    
    // Verificar se o arquivo existe
    if (fs.existsSync(strategyPath)) {
      return strategyPath;
    } else if (fs.existsSync(path.join(STRATEGIES_DIR, cmdArg))) {
      return path.join(STRATEGIES_DIR, cmdArg);
    } else {
      console.error(`❌ ERRO: Estratégia "${cmdArg}" não encontrada`);
      // Continuar para o menu interativo
    }
  }
  
  // Se não foi passado argumento ou o arquivo não existe, mostrar menu interativo
  const strategies = listStrategies();
  
  if (strategies.length === 1) {
    console.log(`🔄 Usando a única estratégia disponível: ${strategies[0]}`);
    return path.join(STRATEGIES_DIR, strategies[0]);
  }
  
  console.log('📋 Estratégias disponíveis:');
  strategies.forEach((file, index) => {
    console.log(`${index + 1}. ${file}`);
  });
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('🔢 Digite o número da estratégia que deseja executar: ', (answer) => {
      rl.close();
      
      const index = parseInt(answer) - 1;
      if (isNaN(index) || index < 0 || index >= strategies.length) {
        console.error('❌ Opção inválida. Usando a primeira estratégia.');
        resolve(path.join(STRATEGIES_DIR, strategies[0]));
      } else {
        resolve(path.join(STRATEGIES_DIR, strategies[index]));
      }
    });
  });
}

// Função para selecionar o tipo de conta (real ou virtual)
async function selectAccountType() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('🔢 Selecione o tipo de conta (1 = Virtual, 2 = Real): ', (answer) => {
      rl.close();
      
      if (answer === '2') {
        console.log('⚠️ ATENÇÃO: Usando conta REAL. Operações usarão dinheiro real!');
        resolve('real');
      } else {
        console.log('🧪 Usando conta VIRTUAL (demo)');
        resolve('virtual');
      }
    });
  });
}

// Função principal
(async () => {
  try {
    // Selecionar estratégia
    const strategyPath = await selectStrategy();
    console.log(`🔍 Usando estratégia: ${strategyPath}`);
    
    // Selecionar tipo de conta
    const accountType = await selectAccountType();
    
    // Analisar arquivo de estratégia
    console.log('🔍 Analisando arquivo de estratégia...');
    const strategy = parseXmlStrategy(strategyPath);
    
    // Conectar à Deriv
    console.log(`🔌 Conectando à Deriv (${accountType})...`);
    const ws = await connect(process.env.DERIV_TOKEN, accountType);
    
    // Executar estratégia
    console.log('🚀 Executando estratégia...');
    await executeStrategy(ws, strategy);
  } catch (error) {
    console.error('❌ ERRO:', error.message);
    process.exit(1);
  }
})();

