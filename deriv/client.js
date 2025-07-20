const WebSocket = require('ws');

function connect(token, account_type = 'real') {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=31661');
    
    // Set a connection timeout
    const connectionTimeout = setTimeout(() => {
      reject(new Error('Connection timeout: Could not connect to Deriv API'));
      ws.terminate();
    }, 10000);

    ws.on('open', () => {
      console.log('🔌 Conectado ao servidor Deriv');
      clearTimeout(connectionTimeout);
      
      // Send authorization request
      const authRequest = { authorize: token };
      console.log('🔑 Enviando solicitação de autorização...');
      ws.send(JSON.stringify(authRequest));
    });

    ws.on('message', (msg) => {
      try {
        const data = JSON.parse(msg);
        
        if (data.msg_type === 'authorize') {
          if (data.error) {
            console.error('❌ Erro de autenticação:', data.error.message);
            reject(data.error);
            return;
          }
          
          console.log('✅ Autenticado como:', data.authorize.loginid, 
                     `(${data.authorize.is_virtual ? 'Demo' : 'Real'})`);
          
          // Check if we need to switch to virtual
          if (account_type === 'virtual' && !data.authorize.is_virtual) {
            console.log('🔄 Solicitando troca para conta virtual...');
            ws.send(JSON.stringify({ balance: 1, account: "all" }));
            
            // We'll handle the account switching in another message handler
          } else {
            resolve(ws);
          }
        } else if (data.msg_type === 'balance') {
          // Handle account list to switch to virtual if needed
          if (account_type === 'virtual' && data.balance && data.balance.accounts) {
            const virtualAccount = data.balance.accounts.find(acc => acc.account_type === 'virtual');
            
            if (virtualAccount) {
              console.log('🔄 Trocando para conta virtual:', virtualAccount.loginid);
              ws.send(JSON.stringify({ authorize: token, account: virtualAccount.loginid }));
            } else {
              console.error('❌ Conta virtual não encontrada');
              reject(new Error('Virtual account not found'));
            }
          }
        } else if (data.msg_type === 'error') {
          console.error('❌ Erro da API:', data.error.message);
          reject(data.error);
        }
      } catch (e) {
        console.error('❌ Erro ao processar mensagem:', e.message);
        reject(e);
      }
    });

    ws.on('error', (error) => {
      console.error('❌ Erro de conexão WebSocket:', error.message);
      clearTimeout(connectionTimeout);
      reject(error);
    });

    ws.on('close', (code, reason) => {
      console.log(`🔌 Conexão fechada: ${code} - ${reason || 'Sem motivo especificado'}`);
    });
  });
}

module.exports = { connect };

