export interface Treinador {
  id: string
  email: string
  nome: string
  cref: string
  logo_url?: string
  telefone?: string
  plano: 'basico' | 'profissional' | 'premium'
  alunos_limite: number
  ativo: boolean
  expira_em?: string
  criado_em: string
  atualizado_em: string
}

export type Sexo = 'M' | 'F'

export interface Aluno {
  id: string
  treinador_id: string
  nome: string
  email?: string
  telefone?: string
  data_nascimento: string
  sexo: Sexo
  objetivo: string
  observacoes?: string
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

export interface Avaliacao {
  id: string
  aluno_id: string
  treinador_id: string
  peso: number
  altura: number
  idade: number
  percentual_gordura?: number
  gordura_kg?: number
  massa_magra_kg?: number
  agua_corporal?: number
  gordura_visceral?: number
  taxa_metabolica_basal?: number
  idade_fisiologica?: number
  laudo_ia?: string
  foto_frente_url?: string
  foto_lado_url?: string
  foto_costas_url?: string
  pdf_url?: string
  created_at: string
}

export type NivelExperiencia = 'iniciante' | 'intermediario' | 'avancado'
export type TipoCriacao = 'ia' | 'manual'

export interface Exercicio {
  nome: string
  series: number
  repeticoes: string
  descanso: string
  observacao?: string
}

export interface DiaTreino {
  dia: string
  nome: string
  exercicios: Exercicio[]
}

export interface TreinoCompleto {
  dias: DiaTreino[]
}

export interface Treino {
  id: string
  aluno_id: string
  avaliacao_id?: string
  treinador_id: string
  titulo: string
  objetivo: string
  nivel_experiencia: NivelExperiencia
  frequencia_semanal: number
  duracao_minutos: number
  treino_completo: TreinoCompleto
  tipo_criacao: TipoCriacao
  ativo: boolean
  versao: number
  created_at: string
}

export interface AvaliacaoComAluno extends Avaliacao {
  aluno: Aluno
}

export interface TreinoComAluno extends Treino {
  aluno: Aluno
}
