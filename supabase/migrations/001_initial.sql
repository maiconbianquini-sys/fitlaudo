-- =============================================
-- FitLaudo — Migration 001: Initial Schema
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TABLE: treinadores
-- =============================================
CREATE TABLE IF NOT EXISTS public.treinadores (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          TEXT NOT NULL,
  nome           TEXT NOT NULL DEFAULT '',
  cref           TEXT,
  logo_url       TEXT,
  telefone       TEXT,
  plano          TEXT NOT NULL DEFAULT 'basico' CHECK (plano IN ('basico', 'profissional', 'premium')),
  alunos_limite  INTEGER NOT NULL DEFAULT 20,
  ativo          BOOLEAN NOT NULL DEFAULT TRUE,
  expira_em      TIMESTAMPTZ,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- TABLE: alunos
-- =============================================
CREATE TABLE IF NOT EXISTS public.alunos (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  treinador_id     UUID NOT NULL REFERENCES public.treinadores(id) ON DELETE CASCADE,
  nome             TEXT NOT NULL,
  email            TEXT,
  telefone         TEXT,
  data_nascimento  DATE NOT NULL,
  sexo             TEXT NOT NULL CHECK (sexo IN ('M', 'F')),
  objetivo         TEXT NOT NULL,
  observacoes      TEXT,
  ativo            BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS alunos_treinador_id_idx ON public.alunos(treinador_id);

-- =============================================
-- TABLE: avaliacoes
-- =============================================
CREATE TABLE IF NOT EXISTS public.avaliacoes (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aluno_id              UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  treinador_id          UUID NOT NULL REFERENCES public.treinadores(id) ON DELETE CASCADE,
  peso                  NUMERIC(5,2) NOT NULL,
  altura                NUMERIC(5,1) NOT NULL,
  idade                 INTEGER NOT NULL,
  percentual_gordura    NUMERIC(4,1),
  gordura_kg            NUMERIC(5,2),
  massa_magra_kg        NUMERIC(5,2),
  agua_corporal         NUMERIC(4,1),
  gordura_visceral      NUMERIC(4,1),
  taxa_metabolica_basal INTEGER,
  idade_fisiologica     INTEGER,
  laudo_ia              TEXT,
  foto_frente_url       TEXT,
  foto_lado_url         TEXT,
  foto_costas_url       TEXT,
  pdf_url               TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS avaliacoes_aluno_id_idx ON public.avaliacoes(aluno_id);
CREATE INDEX IF NOT EXISTS avaliacoes_treinador_id_idx ON public.avaliacoes(treinador_id);

-- =============================================
-- TABLE: treinos
-- =============================================
CREATE TABLE IF NOT EXISTS public.treinos (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aluno_id            UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  avaliacao_id        UUID REFERENCES public.avaliacoes(id) ON DELETE SET NULL,
  treinador_id        UUID NOT NULL REFERENCES public.treinadores(id) ON DELETE CASCADE,
  titulo              TEXT NOT NULL,
  objetivo            TEXT NOT NULL,
  nivel_experiencia   TEXT NOT NULL DEFAULT 'iniciante' CHECK (nivel_experiencia IN ('iniciante', 'intermediario', 'avancado')),
  frequencia_semanal  INTEGER NOT NULL DEFAULT 3,
  duracao_minutos     INTEGER NOT NULL DEFAULT 60,
  treino_completo     JSONB NOT NULL DEFAULT '{}',
  tipo_criacao        TEXT NOT NULL DEFAULT 'ia' CHECK (tipo_criacao IN ('ia', 'manual')),
  ativo               BOOLEAN NOT NULL DEFAULT TRUE,
  versao              INTEGER NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS treinos_aluno_id_idx ON public.treinos(aluno_id);
CREATE INDEX IF NOT EXISTS treinos_avaliacao_id_idx ON public.treinos(avaliacao_id);
CREATE INDEX IF NOT EXISTS treinos_treinador_id_idx ON public.treinos(treinador_id);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.treinadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treinos ENABLE ROW LEVEL SECURITY;

-- Treinadores: can only read/update own record
CREATE POLICY "treinadores_self_select" ON public.treinadores
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "treinadores_self_update" ON public.treinadores
  FOR UPDATE USING (auth.uid() = id);

-- Alunos: treinador can CRUD own alunos
CREATE POLICY "alunos_treinador_select" ON public.alunos
  FOR SELECT USING (treinador_id = auth.uid());

CREATE POLICY "alunos_treinador_insert" ON public.alunos
  FOR INSERT WITH CHECK (treinador_id = auth.uid());

CREATE POLICY "alunos_treinador_update" ON public.alunos
  FOR UPDATE USING (treinador_id = auth.uid());

CREATE POLICY "alunos_treinador_delete" ON public.alunos
  FOR DELETE USING (treinador_id = auth.uid());

-- Avaliacoes: treinador can CRUD own avaliacoes
CREATE POLICY "avaliacoes_treinador_select" ON public.avaliacoes
  FOR SELECT USING (treinador_id = auth.uid());

CREATE POLICY "avaliacoes_treinador_insert" ON public.avaliacoes
  FOR INSERT WITH CHECK (treinador_id = auth.uid());

CREATE POLICY "avaliacoes_treinador_update" ON public.avaliacoes
  FOR UPDATE USING (treinador_id = auth.uid());

CREATE POLICY "avaliacoes_treinador_delete" ON public.avaliacoes
  FOR DELETE USING (treinador_id = auth.uid());

-- Treinos: treinador can CRUD own treinos
CREATE POLICY "treinos_treinador_select" ON public.treinos
  FOR SELECT USING (treinador_id = auth.uid());

CREATE POLICY "treinos_treinador_insert" ON public.treinos
  FOR INSERT WITH CHECK (treinador_id = auth.uid());

CREATE POLICY "treinos_treinador_update" ON public.treinos
  FOR UPDATE USING (treinador_id = auth.uid());

CREATE POLICY "treinos_treinador_delete" ON public.treinos
  FOR DELETE USING (treinador_id = auth.uid());

-- =============================================
-- TRIGGER: auto-create treinador on auth signup
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.treinadores (id, email, nome)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
