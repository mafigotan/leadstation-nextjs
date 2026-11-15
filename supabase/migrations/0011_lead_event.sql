-- Game result recorded by a promotion page's event element.

begin;

alter table public.leads add column if not exists event text check (char_length(event) <= 200);

commit;
