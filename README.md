# Meu Dia IA

Assistente pessoal com IA: agenda, tarefas, finanças e lembretes.

- **App:** site estático (esta pasta), publicado na Vercel.
- **Banco, login e IA:** Supabase, projeto `meu-dia-ia` (São Paulo).
- **IA:** Claude Haiku 5.5, chamado só pelo servidor (função `assistente` no Supabase). A chave fica em Edge Functions → Secrets.

## Arquivos

| Arquivo | Para que serve |
| --- | --- |
| `index.html` | O app inteiro (telas, login, ligação com o banco) |
| `manifest.webmanifest` | Permite instalar o app na tela inicial do celular |
| `sw.js` | Faz o app abrir rápido e aguentar internet instável |
| `icon-*.png`, `apple-touch-icon.png` | Ícones do app |
| `vercel.json` | Cabeçalhos de segurança da hospedagem |

## Atualizar o app

Substitua os arquivos no GitHub (Add file → Upload files). A Vercel publica sozinha em cerca de 1 minuto.
