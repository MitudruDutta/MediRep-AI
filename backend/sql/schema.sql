-- Enable extensions
create extension if not exists vector;
create extension if not exists pg_trgm;

-- RAG document chunks
create table if not exists document_chunks (
    id uuid default gen_random_uuid() primary key,
    content text not null,
    metadata jsonb,
    embedding vector(768),
    created_at timestamptz default now()
);

create index if not exists document_chunks_embedding_idx on document_chunks 
using hnsw (embedding vector_cosine_ops)
with (m = 16, ef_construction = 64);

-- Chat history
create table if not exists chat_history (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id),
    message text not null,
    response text not null,
    patient_context jsonb,
    created_at timestamptz default now()
);

-- Saved drugs
create table if not exists saved_drugs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id),
    drug_name text not null,
    notes text,
    created_at timestamptz default now(),
    unique(user_id, drug_name)
);

-- Indian Medicines Database
create table if not exists indian_drugs (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    generic_name text,
    manufacturer text,
    price_raw text,
    price numeric,
    pack_size text,
    is_discontinued boolean default false,
    therapeutic_class text,
    action_class text,
    side_effects text,
    substitutes text[],
    embedding vector(768),
    created_at timestamptz default now()
);

create index if not exists idx_indian_drugs_name_trgm on indian_drugs using gin (name gin_trgm_ops);
create index if not exists idx_indian_drugs_generic_trgm on indian_drugs using gin (generic_name gin_trgm_ops);

-- RAG match function
create or replace function match_documents(
    query_embedding vector(768),
    match_count int default 5
)
returns table (
    id uuid,
    content text,
    metadata jsonb,
    similarity float
)
language plpgsql as $$
begin
    return query
    select
        document_chunks.id,
        document_chunks.content,
        document_chunks.metadata,
        1 - (document_chunks.embedding <=> query_embedding) as similarity
    from document_chunks
    order by document_chunks.embedding <=> query_embedding
    limit match_count;
end;
$$;
