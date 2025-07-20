let profit = 0;
let lossCount = 0;
let activeContract = false;
let pingInterval;
let totalTrades = 0;
let winTrades = 0;
let lossTrades = 0;
let lastDigit = null;
let tickHistory = [];
let currentTick = null;
// Variáveis específicas para estratégia advance
let digitCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
let tickCount = 0;
let winCount = 0;
// Variáveis específicas para estratégia maxpro
let virtualLossCount = 0;

function logStatus(p, stake) {
  const winRate = totalTrades > 0 ? ((winTrades / totalTrades) * 100).toFixed(1) : 0;
  console.log(`🟡 Total: ${p.toFixed(2)} | Próxima aposta: ${stake.toFixed(2)} | Losses: ${lossCount} | Win rate: ${winRate}% (${winTrades}/${totalTrades})`);
}

async function executeStrategy(ws, strategy) {
  console.log('🚀 Iniciando execução da estratégia');

  const {
    name,
    stake,
    prediction,
    martingale,
    martingaleFactor,
    stopLoss,
    takeProfit,
    lossCountLimit,
    maxMartingaleLevel,
    stakeAfterWin,
    filterCondition,
    // Informações de mercado extraídas do XML
    market = 'synthetic_index',
    submarket = 'random_index',
    symbol = 'R_100',
    contractType = 'overunder',
    contractTypeCategory = 'DIGITUNDER',
    candleInterval = 60,
    duration = 1,
    duration_unit = 't',
    // Propriedades específicas da estratégia advance
    isAdvanceStrategy = false,
    entryPercentage = 8,
    martingaleParts = 2,
    // Propriedades específicas da estratégia maxpro
    isMaxproStrategy = false,
    virtualLoss = 1
  } = strategy;

  console.log(`📈 Estratégia: ${name}`);
  console.log(`🎯 Mercado: ${market}/${submarket}/${symbol}`);

  // Mostrar informações específicas com base no tipo de contrato
  if (contractType === 'risefall') {
    console.log(`📊 Contrato: ${contractTypeCategory} (Rise/Fall) | Duração: ${duration} ${duration_unit}`);
  } else {
    console.log(`📊 Contrato: ${contractTypeCategory} ${prediction ? `(${prediction})` : ''}`);
  }

  console.log(`⚙️ Martingale: ${martingaleFactor}x após ${lossCountLimit} loss(es), máximo ${maxMartingaleLevel} níveis`);

  let currentStake = stake;
  let startTime = new Date();

  // Função para manter a conexão ativa
  pingInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ ping: 1 }));
    }
  }, 30000);

  // Função para mostrar estatísticas da sessão
  const showStats = () => {
    const runTime = Math.floor((new Date() - startTime) / 1000);
    const minutes = Math.floor(runTime / 60);
    const seconds = runTime % 60;

    console.log('\n📊 ESTATÍSTICAS DA SESSÃO:');
    console.log(`⏱️ Tempo de execução: ${minutes}m ${seconds}s`);
    console.log(`� Laucro total: ${profit.toFixed(2)}`);
    console.log(`🎯 Total de operações: ${totalTrades}`);
    console.log(`✅ Vitórias: ${winTrades} (${totalTrades > 0 ? ((winTrades / totalTrades) * 100).toFixed(1) : 0}%)`);
    console.log(`❌ Derrotas: ${lossTrades} (${totalTrades > 0 ? ((lossTrades / totalTrades) * 100).toFixed(1) : 0}%)`);
    console.log(`💵 Valor inicial: ${stake}`);
    console.log(`💵 Valor atual: ${currentStake.toFixed(2)}`);
    console.log('');
  };

  // Função para obter o último dígito do preço atual
  const getLastDigit = async () => {
    return new Promise((resolve) => {
      ws.send(JSON.stringify({
        ticks: symbol,
        subscribe: 1
      }));

      const handler = (msg) => {
        try {
          const data = JSON.parse(msg);
          if (data.msg_type === 'tick') {
            const price = data.tick.quote;
            const digit = parseInt(price.toString().slice(-1));
            ws.removeListener('message', handler);
            resolve(digit);
          }
        } catch (e) {
          console.error('❌ Erro ao processar tick:', e.message);
        }
      };

      ws.on('message', handler);

      // Timeout para evitar espera infinita
      setTimeout(() => {
        ws.removeListener('message', handler);
        resolve(Math.floor(Math.random() * 10)); // Fallback para um dígito aleatório
      }, 5000);
    });
  };

  // Função para analisar tendência baseada nos últimos ticks
  const analyzeTrend = () => {
    if (tickHistory.length < 20) {
      return null; // Não temos dados suficientes
    }
    
    const last20Ticks = tickHistory.slice(-20);
    const maxPrice = Math.max(...last20Ticks);
    const minPrice = Math.min(...last20Ticks);
    
    return { maxPrice, minPrice };
  };

  // Função para analisar dígitos para a estratégia advance
  const analyzeDigitsForAdvance = () => {
    if (tickCount < 25) {
      console.log(`📊 Coletando dados... ${tickCount}/25 ticks`);
      return null; // Precisa de pelo menos 25 ticks
    }
    
    // Calcular porcentagens dos dígitos 0 e 1
    const totalTicks = Object.values(digitCounts).reduce((sum, count) => sum + count, 0);
    const percentage0 = totalTicks > 0 ? (digitCounts[0] / totalTicks) * 100 : 0;
    const percentage1 = totalTicks > 0 ? (digitCounts[1] / totalTicks) * 100 : 0;
    
    console.log(`📊 Análise de dígitos: 0=${percentage0.toFixed(1)}%, 1=${percentage1.toFixed(1)}%`);
    
    // Verificar se as condições de entrada foram atendidas
    if (percentage0 <= entryPercentage && percentage1 <= entryPercentage) {
      console.log(`🎯 Condição de entrada atendida! (0 e 1 <= ${entryPercentage}%)`);
      return 'DIGITOVER'; // Apostar em DIGITOVER quando ambos estão baixos
    }
    
    return null; // Não fazer trade ainda
  };

  // Função para determinar o tipo de contrato com base na estratégia
  const determineContractType = async () => {
    // Lógica específica para estratégia advance
    if (isAdvanceStrategy) {
      return analyzeDigitsForAdvance();
    }

    // Lógica específica para estratégia maxpro
    if (isMaxproStrategy) {
      // Só fazer trade quando o contador de loss virtual atingir o valor definido
      if (virtualLossCount >= virtualLoss) {
        console.log(`🎯 Condição maxpro atendida! Loss virtual: ${virtualLossCount}/${virtualLoss}`);
        virtualLossCount = 0; // Reset contador após fazer trade
        return 'DIGITOVER';
      } else {
        console.log(`📊 Aguardando loss virtual... ${virtualLossCount}/${virtualLoss}`);
        return null; // Não fazer trade ainda
      }
    }

    // Para estratégias evenodd com both, precisamos decidir com base no último dígito
    if (contractType === 'evenodd' && contractTypeCategory === 'both') {
      lastDigit = await getLastDigit();
      console.log(`🔢 Último dígito: ${lastDigit}`);

      // Se o último dígito for ímpar, apostamos em par (DIGITEVEN)
      if (lastDigit % 2 === 1) {
        return 'DIGITEVEN';
      }
      // Se o último dígito for par, apostamos em ímpar (DIGITODD)
      else {
        return 'DIGITODD';
      }
    }

    // Para estratégias Rise/Fall com análise de tendência (wise_pro_tendencia)
    if (contractType === 'risefall' && contractTypeCategory === 'both') {
      const trend = analyzeTrend();
      
      if (!trend || !currentTick) {
        console.log('📊 Aguardando dados suficientes para análise de tendência...');
        return null; // Não fazer trade ainda
      }
      
      // Lógica da estratégia wise_pro_tendencia:
      // Se o tick atual >= máximo dos últimos 20 ticks, comprar PUT (contra a tendência)
      if (currentTick >= trend.maxPrice) {
        console.log(`📈 ALTA MÁXIMA detectada (${currentTick} >= ${trend.maxPrice}) - Comprando PUT`);
        return 'PUT';
      }
      // Se o tick atual <= mínimo dos últimos 20 ticks, comprar CALL (contra a tendência)
      else if (currentTick <= trend.minPrice) {
        console.log(`📉 BAIXA MÍNIMA detectada (${currentTick} <= ${trend.minPrice}) - Comprando CALL`);
        return 'CALL';
      }
      
      // Se não está em extremo, não fazer trade
      console.log(`📊 Aguardando padrão gráfico... Atual: ${currentTick}, Max: ${trend.maxPrice}, Min: ${trend.minPrice}`);
      return null;
    }

    // Para estratégias Rise/Fall normais
    if (contractType === 'risefall') {
      return contractTypeCategory; // CALL ou PUT
    }

    // Para outros tipos de contrato, usamos o que está definido na estratégia
    return contractTypeCategory;
  };

  const sendTrade = async () => {
    if (activeContract) {
      console.log('⚠️ Já existe um contrato ativo, aguardando finalização...');
      return;
    }

    // Determinar o tipo de contrato a ser usado
    const actualContractType = await determineContractType();
    
    // Se não conseguiu determinar o tipo de contrato (ex: aguardando dados), não fazer trade
    if (!actualContractType) {
      activeContract = false;
      // Tentar novamente em 2 segundos
      setTimeout(sendTrade, 2000);
      return;
    }

    activeContract = true;

    // Configurar os parâmetros do contrato
    const buyParams = {
      amount: currentStake,
      basis: "stake",
      contract_type: actualContractType,
      currency: "USD",
      duration: duration || 1,
      duration_unit: duration_unit || 't',
      symbol: symbol
    };

    // Adicionar barreira (prediction) apenas para contratos que precisam
    if (contractType === 'overunder' || contractType === 'matchesdiffers') {
      buyParams.barrier = prediction;
    }

    const buyReq = {
      buy: 1,
      price: currentStake,
      parameters: buyParams
    };

    console.log(`🛒 Enviando ordem: ${actualContractType} ${prediction ? prediction : ''} | Valor: ${currentStake.toFixed(2)}`);
    ws.send(JSON.stringify(buyReq));
  };

  // Iniciar verificação de saldo
  ws.send(JSON.stringify({ balance: 1 }));
  
  // Para estratégias que precisam de análise de ticks, subscrever aos ticks
  if (contractType === 'risefall' && contractTypeCategory === 'both') {
    console.log('📊 Iniciando coleta de dados de ticks para análise de tendência...');
    ws.send(JSON.stringify({
      ticks: symbol,
      subscribe: 1
    }));
  }
  
  // Para estratégia advance, também precisamos coletar ticks para análise de dígitos
  if (isAdvanceStrategy) {
    console.log('📊 Iniciando coleta de dados de dígitos para estratégia advance...');
    ws.send(JSON.stringify({
      ticks: symbol,
      subscribe: 1
    }));
  }
  
  // Para estratégia maxpro, também precisamos coletar ticks para análise de loss virtual
  if (isMaxproStrategy) {
    console.log('📊 Iniciando coleta de dados de ticks para estratégia maxpro...');
    ws.send(JSON.stringify({
      ticks: symbol,
      subscribe: 1
    }));
  }

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);

      // Ignorar mensagens de ping/pong
      if (data.msg_type === 'ping' || data.msg_type === 'pong') {
        return;
      }
      
      // Processar ticks para análise de tendência
      if (data.msg_type === 'tick') {
        const price = data.tick.quote;
        currentTick = price;
        tickHistory.push(price);
        
        // Manter apenas os últimos 50 ticks para economizar memória
        if (tickHistory.length > 50) {
          tickHistory = tickHistory.slice(-50);
        }
        
        // Para estratégia advance, coletar dados de dígitos
        if (isAdvanceStrategy) {
          const lastDigit = parseInt(price.toString().slice(-1));
          digitCounts[lastDigit]++;
          tickCount++;
          
          // A cada 10 ticks, mostrar estatísticas dos dígitos
          if (tickCount % 10 === 0) {
            const totalTicks = Object.values(digitCounts).reduce((sum, count) => sum + count, 0);
            const percentage0 = totalTicks > 0 ? (digitCounts[0] / totalTicks) * 100 : 0;
            const percentage1 = totalTicks > 0 ? (digitCounts[1] / totalTicks) * 100 : 0;
            console.log(`📊 Dígitos coletados: ${tickCount} | 0=${percentage0.toFixed(1)}%, 1=${percentage1.toFixed(1)}%`);
          }
          
          // Verificar se pode fazer trade (após coletar dados suficientes)
          if (tickCount >= 25 && !activeContract) {
            const contractType = analyzeDigitsForAdvance();
            if (contractType) {
              sendTrade();
            }
          }
          
          return; // Importante: retornar aqui para não processar outras lógicas
        }
        
        // Para estratégia maxpro, processar sistema de loss virtual
        if (isMaxproStrategy) {
          const lastDigit = parseInt(price.toString().slice(-1));
          
          // Lógica do maxpro: se último dígito <= previsão, incrementar contador de loss virtual
          if (lastDigit <= prediction) {
            virtualLossCount++;
            console.log(`📊 LOSS VIRTUAL ${virtualLossCount} (dígito ${lastDigit} <= ${prediction})`);
          } else {
            // Reset contador se dígito > previsão
            virtualLossCount = 0;
            console.log(`📊 Reset loss virtual (dígito ${lastDigit} > ${prediction})`);
          }
          
          // Verificar se pode fazer trade
          if (virtualLossCount >= virtualLoss && !activeContract) {
            sendTrade();
          }
          
          return; // Importante: retornar aqui para não processar outras lógicas
        }

        // Para estratégias de análise de tendência, não fazer trade automaticamente
        // O trade será feito quando as condições forem atendidas
        if (contractType === 'risefall' && contractTypeCategory === 'both' && !activeContract) {
          // Verificar se temos dados suficientes e se as condições estão atendidas
          const trend = analyzeTrend();
          if (trend && currentTick) {
            if (currentTick >= trend.maxPrice || currentTick <= trend.minPrice) {
              sendTrade();
            }
          }
        }
        
        return;
      }

      // Verificar saldo
      if (data.msg_type === 'balance') {
        console.log(`💰 Saldo atual: ${data.balance.balance} ${data.balance.currency}`);

        // Para estratégias normais, iniciar negociação após verificar o saldo
        if (!activeContract && !(contractType === 'risefall' && contractTypeCategory === 'both') && !isAdvanceStrategy && !isMaxproStrategy) {
          console.log('🎮 Iniciando operações...');
          sendTrade();
        } else if (contractType === 'risefall' && contractTypeCategory === 'both') {
          console.log('📊 Aguardando dados de ticks para análise de tendência...');
        } else if (isAdvanceStrategy) {
          console.log('📊 Aguardando dados de dígitos para estratégia advance...');
        } else if (isMaxproStrategy) {
          console.log('📊 Aguardando dados de ticks para estratégia maxpro...');
        }
        return;
      }

      // Verifica se resposta é válida de compra
      if (data.msg_type === 'buy') {
        if (data.error) {
          console.error('❌ Erro ao comprar:', data.error.message);
          activeContract = false;

          // Tentar novamente após um tempo
          setTimeout(sendTrade, 3000);
          return;
        }

        if (data.buy?.contract_id) {
          const contract_id = data.buy.contract_id;
          console.log(`📝 Contrato criado: ID ${contract_id}`);

          // Inscrever para atualizações do contrato
          ws.send(JSON.stringify({
            proposal_open_contract: 1,
            subscribe: 1,
            contract_id: contract_id
          }));
        }
        return;
      }

      // Atualizações do contrato
      if (data.msg_type === 'proposal_open_contract') {
        const contract = data.proposal_open_contract;

        // Contrato finalizado
        if (contract.is_sold) {
          const isWin = parseFloat(contract.profit) >= 0;
          const resultado = isWin ? '✅ WIN' : '❌ LOSS';
          console.log(`📊 Resultado: ${resultado} | Lucro: ${contract.profit}`);

          // Atualizar estatísticas
          totalTrades++;
          if (isWin) {
            profit += parseFloat(contract.profit);
            winTrades++;
            
            // Lógica específica para estratégia advance
            if (isAdvanceStrategy) {
              winCount++;
              lossCount = 0;
              
              // Se atingiu o número de vitórias necessárias (parcelas de martingale), resetar valor
              if (winCount >= martingaleParts) {
                console.log(`🎯 ${martingaleParts} vitórias atingidas! Resetando valor para inicial.`);
                currentStake = stake;
                winCount = 0;
              }
            } else {
              lossCount = 0;
              currentStake = stakeAfterWin;
            }
          } else {
            profit -= currentStake;
            lossTrades++;
            lossCount++;
            
            // Lógica específica para estratégia advance
            if (isAdvanceStrategy) {
              winCount = 0; // Reset contador de wins em caso de loss
              
              // Aplicar martingale multiplicando pelo valor absoluto do stake atual
              const newStake = Math.abs(currentStake) * martingaleFactor;
              console.log(`📈 Aplicando martingale advance: ${currentStake.toFixed(2)} → ${newStake.toFixed(2)}`);
              currentStake = newStake;
            } else {
              if (lossCount >= lossCountLimit) {
                // Aplicar martingale, mas verificar se não excede o limite máximo
                if (lossCount <= maxMartingaleLevel) {
                  const newStake = currentStake * martingaleFactor;
                  console.log(`📈 Aplicando martingale: ${currentStake.toFixed(2)} → ${newStake.toFixed(2)}`);
                  currentStake = newStake;
                } else {
                  console.log(`⚠️ Limite de martingale atingido (${maxMartingaleLevel}). Reiniciando valor.`);
                  currentStake = stake;
                  lossCount = 0;
                }
              }
            }
          }

          logStatus(profit, currentStake);
          activeContract = false;

          // Verificar condições de saída
          if (profit >= takeProfit) {
            console.log('🎯 META ATINGIDA!');
            showStats();
            clearInterval(pingInterval);
            ws.close();
            process.exit(0);
          } else if (Math.abs(profit) >= stopLoss && profit < 0) {
            console.log('🚨 LIMITE DE PERDA ATINGIDO!');
            showStats();
            clearInterval(pingInterval);
            ws.close();
            process.exit(0);
          } else {
            // Mostrar estatísticas a cada 10 operações
            if (totalTrades % 10 === 0) {
              showStats();
            }

            // Aguardar antes da próxima ordem
            setTimeout(sendTrade, 1000);
          }
        } else {
          // Contrato em andamento - mostrar status apenas se houver mudança
          if (contract.tick_count) {
            console.log(`⏳ Contrato em andamento: ${contract.status} | Tick: ${contract.tick_count || 0}`);
          }
        }
        return;
      }

      // Erro inesperado
      if (data.msg_type === 'error') {
        console.error('❌ ERRO da Deriv:', data.error.message);
        activeContract = false;

        // Tentar novamente após um tempo, a menos que seja um erro fatal
        if (data.error.code === 'InputValidationFailed') {
          setTimeout(sendTrade, 3000);
        } else {
          clearInterval(pingInterval);
          ws.close();
          process.exit(1);
        }
      }
    } catch (e) {
      console.error('❌ Erro ao processar mensagem:', e.message);
    }
  });

  // Configurar manipuladores para interrupção do programa
  process.on('SIGINT', () => {
    console.log('\n🛑 Programa interrompido pelo usuário');
    showStats();
    clearInterval(pingInterval);
    ws.close();
    process.exit(0);
  });

  // Lidar com fechamento da conexão
  ws.on('close', () => {
    console.log('🔌 Conexão fechada');
    clearInterval(pingInterval);
    process.exit(0);
  });

  // Lidar com erros de conexão
  ws.on('error', (error) => {
    console.error('❌ Erro de conexão:', error.message);
    clearInterval(pingInterval);
    process.exit(1);
  });
}

module.exports = { executeStrategy };