export type OfficialFamily = 'cleaner' | 'profile' | 'suggestions';

export const OFFICIAL_FAMILIES: OfficialFamily[] = ['cleaner', 'profile', 'suggestions'];

export interface OfficialSource {
  family: OfficialFamily;
  localPath: string;
  url: string;
}

export const OFFICIAL_SOURCES: Record<OfficialFamily, OfficialSource> = {
  cleaner: {
    family: 'cleaner',
    localPath: 'official/source/cleaner.yml',
    url: 'https://dadata.ru/files/openapi/cleaner.yml',
  },
  profile: {
    family: 'profile',
    localPath: 'official/source/profile.yml',
    url: 'https://dadata.ru/files/openapi/profile.yml',
  },
  suggestions: {
    family: 'suggestions',
    localPath: 'official/source/suggestions.yml',
    url: 'https://dadata.ru/files/openapi/suggestions.yml',
  },
};

export function officialSourceFileName(source: OfficialSource): string {
  const segments = new URL(source.url).pathname.split('/');
  const fileName = segments.at(-1);

  if (!fileName) {
    throw new Error(`Official source URL has no file name: ${source.url}`);
  }

  return fileName;
}
