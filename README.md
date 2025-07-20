# Deriv Trading Bot

Bot de negociação automatizada para a plataforma Deriv, que executa estratégias baseadas em arquivos XML.

## Requisitos

- Node.js (v14 ou superior)
- Conta na Deriv (real ou virtual)
- Token de API da Deriv

## Instalação

1. Clone o repositório ou baixe os arquivos
2. Instale as dependências:

```bash
npm install
```

3. Crie um arquivo `.env` na raiz do projeto com seu token da Deriv:

```
DERIV_TOKEN=seu_token_aqui
```

## Como obter um token da Deriv

1. Faça login na sua conta Deriv
2. Acesse: https://app.deriv.com/account/api-token
3. Crie um token com permissões de "Leitura" e "Negociação"
4. Copie o token gerado para o arquivo `.env`

## Uso

Para iniciar o bot:

```bash
node index.js [caminho_da_estrategia]
```

### Exemplos:

```bash
# Iniciar com menu de seleção de estratégia
node index.js

# Iniciar com uma estratégia específica
node index.js strategies/iron.xml

# Iniciar com uma estratégia específica (nome curto)
node index.js iron.xml
```

## Estratégias

As estratégias são definidas em arquivos XML e devem ser colocadas na pasta `strategies/`. 

O bot inclui várias estratégias de exemplo:
- `iron.xml`: Estratégia DIGITUNDER para o índice R_100
- `green.xml`: Estratégia alternativa
- `One50.xml`: Estratégia DIGITEVEN/DIGITODD para o índice R_10 (escolhe automaticamente com base no último dígito)
- `One60.xml`: Estratégia DIGITUNDER para o índice R_10 com barreira 6
- `RiseFall.xml`: Estratégia Rise/Fall (CALL) para o índice R_100 com duração de 5 minutos
- `wise_pro_tendencia.xml`: Estratégia avançada Rise/Fall com análise de tendência (compra contra a tendência em extremos)

## Parâmetros da Estratégia

Os arquivos XML definem os seguintes parâmetros:

- **VALOR INICIAL**: Valor inicial da aposta
- **PREVISÃO**: Número para a previsão (ex: 4 para DIGITUNDER 4)
- **MARTINGALE**: Fator de multiplicação após perda (ex: 0.5 = aumenta 50%)
- **META**: Valor de lucro para encerrar automaticamente
- **LIMITE DE PERDA**: Valor máximo de perda para encerrar automaticamente
- **USAR MARTINGALE APÓS QUANTOS LOSS?**: Número de perdas consecutivas antes de aplicar martingale
- **VALOR APÓS VENCER**: Valor da aposta após uma vitória

## Funcionalidades

- Suporte para contas reais e virtuais (demo)
- Seleção interativa de estratégias
- Estatísticas detalhadas de desempenho
- Aplicação automática de martingale após perdas consecutivas
- Limites de lucro e perda configuráveis
- Reconexão automática em caso de erros
- Suporte para diferentes tipos de contratos e mercados

## Estrutura do Projeto

```
/
├── .env                  # Variáveis de ambiente (token da API)
├── index.js              # Ponto de entrada principal
├── README.md             # Documentação
├── deriv/                # Integração com a API da Deriv
│   └── client.js         # Cliente WebSocket para API da Deriv
├── parser/               # Análise de estratégias
│   └── xmlToStrategy.js  # Conversor de XML para objeto de estratégia
├── strategies/           # Arquivos de estratégia XML
│   ├── green.xml         # Estratégia de exemplo 1
│   └── iron.xml          # Estratégia de exemplo 2
└── strategy/             # Lógica de execução de estratégias
    └── executor.js       # Executor de estratégias
```

## Segurança

- Nunca compartilhe seu token da Deriv
- Comece com pequenos valores ao testar novas estratégias
- Use preferencialmente a conta virtual para testes

## Limitações

- O bot suporta contratos digitais (DIGITUNDER/DIGITOVER/DIGITEVEN/DIGITODD) e Rise/Fall (CALL/PUT)
- A API da Deriv pode ter limites de taxa de requisição
- Negociação automatizada sempre envolve riscos