-- ─────────────────────────────────────────────────────────
-- 0025_cast_slide_images_bucket.sql
-- v0.35.0 — cast-slide-images Storage bucket 생성
-- 누락된 버킷 때문에 PPT+아바타 PIP 영상이 단색 background로 출력되던 이슈 fix.
-- ─────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('cast-slide-images', 'cast-slide-images', true)
on conflict (id) do update set public = true;

-- 누구나 읽기 (HeyGen이 background로 fetch)
drop policy if exists "Public read cast-slide-images" on storage.objects;
create policy "Public read cast-slide-images"
  on storage.objects for select
  using (bucket_id = 'cast-slide-images');

-- INSERT/UPDATE/DELETE는 service_role 전용 (slide-image.tsx가 admin 클라이언트로 호출)
-- 별도 policy 불필요 — service_role은 RLS 우회.
