-- Audit #47 M1: the AA executor trusts max_per_trade_usd / daily_cap_usd from
-- the row, which are bound to the owner's signed payload at insert. Guarantee
-- they can never be silently raised after insert (by any endpoint or manual op)
-- so the signed caps remain the source of truth. Allowed updates: revocation
-- and clearing the key material (encrypted_session_key/approval/auth_signature);
-- the cap columns and the signed identity columns are frozen.
create or replace function freeze_session_key_caps()
returns trigger
language plpgsql
as $$
begin
  if new.max_per_trade_usd is distinct from old.max_per_trade_usd
     or new.daily_cap_usd is distinct from old.daily_cap_usd
     or new.session_address is distinct from old.session_address
     or new.main_address is distinct from old.main_address
     or new.kernel_address is distinct from old.kernel_address
     or new.auth_payload is distinct from old.auth_payload then
    raise exception 'session key caps/identity are immutable after creation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_freeze_session_key_caps on user_session_keys;
create trigger trg_freeze_session_key_caps
  before update on user_session_keys
  for each row execute function freeze_session_key_caps();
