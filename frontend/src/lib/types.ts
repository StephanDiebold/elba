// src/lib/types.ts
export type Tag = {
  id: number;              // <- DB: schlagwortid
  skillclusterId: number;  // <- DB: skillclusterid
  skillcluster: string;
  schlagwort: string;

  cluster?: string | null;
  clusterId?: number | null;
  skillfamily?: string | null;
  skillfamilyId?: number | null;
};

export type SkillclusterOption = {
  id: number;
  name: string;
};

// --- Skillcluster Types ---
export type Skillcluster = {
  skillclusterid: number;
  skillcluster: string;
  clusterid: number;
  beschreibung?: string | null;
  skill_einteilung?: string | null;
  kommentar?: string | null;
  jahr?: number | null;
  strat_landkarte?: string | null;
  skillcluster_norm?: string | null;
  // aus Join
  cluster: string;             // ↔ bei LEFT JOIN: cluster?: string | null;
  skill_familyid: number;      // ↔ bei LEFT JOIN: skill_familyid?: number | null;
  skill_family: string;        // ↔ bei LEFT JOIN: skill_family?: string | null;
};

export type SkillclusterCreate = {
  skillcluster: string;
  clusterid: number;
  beschreibung?: string | null;
  skill_einteilung?: string | null;
  kommentar?: string | null;
  jahr?: number | null;
  strat_landkarte?: string | null;
  skillcluster_norm?: string | null;
};
export type SkillclusterUpdate = Partial<SkillclusterCreate>;

export type ClusterOption = {
  clusterid: number;
  cluster: string;
  skill_familyid: number;
  skill_family: string;
};
