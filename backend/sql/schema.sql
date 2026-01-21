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

-- Indian Medicines Database (250k+ entries)
create table if not exists indian_drugs (
    id uuid default gen_random_uuid() primary key,
    name text not null unique,
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
    description text,  -- Drug description/indications
    interactions_data jsonb,  -- Structured interaction data
    embedding vector(384),  -- Sentence transformer embeddings (all-MiniLM-L6-v2)
    created_at timestamptz default now()
);

-- Indexes for efficient drug lookup
create index if not exists idx_indian_drugs_name_trgm on indian_drugs using gin (name gin_trgm_ops);
create index if not exists idx_indian_drugs_generic_trgm on indian_drugs using gin (generic_name gin_trgm_ops);
create unique index if not exists idx_indian_drugs_name_unique on indian_drugs (name);

-- Vector similarity index (for AI-powered search)
-- Note: This may take time to build on large tables
create index if not exists idx_indian_drugs_embedding on indian_drugs 
using hnsw (embedding vector_cosine_ops)
with (m = 16, ef_construction = 64);

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

-- Vector similarity search for indian_drugs (used by vision service)
create or replace function match_indian_drugs(
    query_embedding vector(384),
    match_count int default 5
)
returns table (
    name text,
    generic_name text,
    manufacturer text,
    price_raw text,
    description text,
    similarity float
)
language plpgsql as $$
begin
    return query
    select
        d.name,
        d.generic_name,
        d.manufacturer,
        d.price_raw,
        d.description,
        1 - (d.embedding <=> query_embedding) as similarity
    from indian_drugs d
    where d.embedding is not null
    order by d.embedding <=> query_embedding
    limit match_count;
end;
$$;

