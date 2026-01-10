# Laura SaaS (MVP) — HTML/CSS/JS + Firebase

## 1) Configurar Firebase
1. Crie um projeto no Firebase.
2. Ative Authentication > Sign-in method > Email/Password.
3. Crie Firestore Database (modo produção ou teste).
4. Cole as credenciais em `js/firebase.js`.

## 2) Regras do Firestore
Cole o conteúdo de `firestore.rules` no Firebase Console > Firestore > Rules.

## 3) Rodar local
Use um servidor simples (Live Server do VSCode, por exemplo).
Abrir direto no arquivo (file://) pode dar problema em alguns navegadores.

## 4) Multi-tenant (SaaS)
- Primeiro login cria automaticamente uma empresa.
- Depois, para outro usuário entrar na MESMA empresa, você precisa criar:
  - empresas/{empresaId}/usuarios/{uid} com role
  - usuarios/{uid} com empresaId
(na próxima etapa a gente cria uma tela "Usuários" pra fazer isso dentro do sistema)
