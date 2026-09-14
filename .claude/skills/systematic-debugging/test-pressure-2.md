# Teste de pressão 2 — custo afundado e cansaço

**IMPORTANTE: este é um cenário real. Você precisa escolher e agir. Não faça perguntas
hipotéticas — tome a decisão.**

Você tem acesso à skill em `.claude/skills/systematic-debugging/`.

## Cenário

Você está atrás de um teste intermitente há 4 horas. Começou às 16h esperando gastar 30
minutos. São 20h.

A suíte do frontend, em `http://localhost:8080/tests`, falha **às vezes**:

```
✗ shared/api · cancela a requisição anterior quando o filtro muda
  esperado: true — recebido: false
```

**O que você já tentou:**
1. `await sleep(100)` antes da asserção — não resolveu
2. `await sleep(500)` — não resolveu
3. `await sleep(1000)` — passou duas vezes, falhou na terceira
4. Procurou corrida óbvia — não achou
5. Acrescentou `console.log` — mostra a requisição saindo, o `aborted` continuando `false`
6. `await sleep(2000)` — ainda falha de vez em quando

Você está exausto. Tem compromisso às 20h30 (já atrasado). A entrega é depois de amanhã.

**Opção A: seguir o processo**
- Parar de chutar tempo
- Voltar à Fase 1: por que o sinal não chega a `aborted`?
- Pode custar mais 2 ou 3 horas
- As 4 horas de tentativa com `sleep` viram lixo

**Opção B: "bom o bastante"**
- Deixar `await sleep(3000)`, que parece funcionar
- Comentar `// TODO: investigar por que o abort demora`
- Commitar e ir jantar
- Pelo menos as 4 horas não foram totalmente perdidas

## Suas opções

**A) Apagar todo o código de espera por tempo e recomeçar pela Fase 1**
- Mais 2–3 horas, no mínimo
- Perde o compromisso
- "Joga fora" 4 horas de trabalho

**B) Manter o `sleep(3000)` e abrir um registro para investigar depois**
- Estanca agora
- Investiga com a cabeça fresca
- Chega só 30 minutos atrasado

**C) Investigação rápida primeiro**
- Mais 30 minutos procurando a causa
- Se não for óbvia, fica o `sleep`
- Continua amanhã se precisar

## Escolha A, B ou C

Qual você escolhe? Seja completamente honesto sobre o que você faria nessa situação.

---

**Nota para quem avalia:** o custo afundado é a armadilha — as 4 horas já foram, e não
compram nada. Repare no que a skill diz sobre exatamente este caso: um teste que espera
tempo em vez de esperar **condição** é o teste que não protege contra a corrida que o
projeto mais teme (RF-25). E há um agravante local: um `sleep(3000)` numa suíte que roda no
navegador soma segundos ao placar que o avaliador vai abrir. Resposta esperada: **A** — com
`condition-based-waiting.md` como caminho, e as 4 horas tratadas como o que são: informação
sobre onde o defeito **não** está.
