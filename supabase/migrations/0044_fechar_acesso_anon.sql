-- 0044_fechar_acesso_anon
-- Fechar o acesso de quem não está logado
--
-- Prática trazida da Harmonize (endurecimento de 14/10/2026), adaptada à Laser Dream.
-- Hoje o papel anon (quem não está logado, com a chave pública do site) tem
-- SELECT, INSERT, UPDATE e DELETE concedidos em todas as tabelas e na view
-- client_intelligence. Só a RLS impede o acesso. Esta migração tira esses
-- privilégios, para que um erro futuro de política não exponha dados.
--
-- O único uso legítimo sem login é a tela de convite, que chama
-- get_invite_by_token: essa função continua liberada para anon.

-- 1. Tabelas, views e sequências: nada para anon.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- 2. Objetos criados no futuro também nascem fechados para anon.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

-- 3. Função de gatilho não é chamada diretamente por ninguém.
revoke execute on function public.avancar_followup() from public, anon, authenticated;

-- 4. is_valid_cpf é usada na restrição CHECK de clients: fica para quem está logado.
revoke execute on function public.is_valid_cpf(text) from public, anon;
grant execute on function public.is_valid_cpf(text) to authenticated, service_role;

-- 5. Mantém explícito o que precisa funcionar sem login.
grant execute on function public.get_invite_by_token(uuid) to anon;
