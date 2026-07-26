import type { OpenAPIV3_1 } from '@scalar/openapi-types';

import type { AnyOfFoldingRule, ExpectedObjectBranch } from './normalization/anyof-folding.ts';
import type { AnyOfSelectionRule } from './normalization/anyof-selection.ts';
import type { SchemaComponentAliasRule } from './normalization/schema-component-aliases.ts';
import { OFFICIAL_SOURCES, type OfficialFamily } from './official-sources.ts';
import type {
  ExtensionMapping,
  OperationMappings,
  TemplateExpansionMapping,
} from './operations/types.ts';

export interface ComparisonConfig {
  anyOfFolding: AnyOfFoldingRule[];
  anyOfSelections: AnyOfSelectionRule[];
  schemaComponentAliases: SchemaComponentAliasRule[];
}

export interface SecurityComparisonConfig {
  whenOfficialUndeclared: OpenAPIV3_1.SecurityRequirementObject[];
  whenOfficialUndeclaredByPath?: Record<string, OpenAPIV3_1.SecurityRequirementObject[]>;
}

export interface OfficialFamilyConfig {
  comparison: ComparisonConfig;
  family: OfficialFamily;
  officialPathPrefix: string;
  officialSourcePath: string;
  operations: OperationMappings;
  security: SecurityComparisonConfig;
  snapshotPath: string;
}

const EMPTY_COMPARISON: ComparisonConfig = {
  anyOfFolding: [],
  anyOfSelections: [],
  schemaComponentAliases: [],
};

const API_KEY_SECURITY: OpenAPIV3_1.SecurityRequirementObject[] = [{ ApiKey: [] }];
const API_AND_SECRET_KEY_SECURITY: OpenAPIV3_1.SecurityRequirementObject[] = [
  { ApiKey: [], SecretKey: [] },
];

const CLEANER_TYPES = [
  'Address',
  'AsIs',
  'Birthdate',
  'Email',
  'Name',
  'Passport',
  'Phone',
  'Vehicle',
];

const CLEANER_PATH_TYPES: Array<[path: string, type: string]> = [
  ['/clean/address', 'Address'],
  ['/clean/birthdate', 'Birthdate'],
  ['/clean/email', 'Email'],
  ['/clean/name', 'Name'],
  ['/clean/passport', 'Passport'],
  ['/clean/phone', 'Phone'],
  ['/clean/vehicle', 'Vehicle'],
];

const CLEANER_ALIASES: Record<string, string> = {
  Address: 'AddressClean',
  AsIs: 'AsIsClean',
  Birthdate: 'DateClean',
  Email: 'EmailClean',
  Name: 'FioClean',
  Passport: 'PassportClean',
  Phone: 'PhoneClean',
  Vehicle: 'VehicleClean',
};

const FIND_BY_ID_TEMPLATE_PATHS = [
  '/findById/car_brand',
  '/findById/country',
  '/findById/court',
  '/findById/currency',
  '/findById/delivery',
  '/findById/fns_unit',
  '/findById/fts_unit',
  '/findById/mktu',
  '/findById/okpd2',
  '/findById/oktmo',
  '/findById/okved2',
  '/findById/party_by',
  '/findById/party_kz',
  '/findById/postal_unit',
];

const SUGGEST_TEMPLATE_PATHS = [
  '/suggest/car_brand',
  '/suggest/country',
  '/suggest/court',
  '/suggest/currency',
  '/suggest/fms_unit',
  '/suggest/fns_unit',
  '/suggest/fts_unit',
  '/suggest/metro',
  '/suggest/mktu',
  '/suggest/okpd2',
  '/suggest/oktmo',
  '/suggest/okved2',
  '/suggest/party_by',
  '/suggest/party_kz',
  '/suggest/postal_unit',
];

const ADMIN_DATA_ONLY_PROPERTIES = [
  'city_district',
  'city_district_fias_id',
  'city_district_kladr_id',
  'city_district_type',
  'city_district_type_full',
  'city_district_with_type',
];

const MUNICIPAL_DATA_ONLY_PROPERTIES = [
  'sub_area',
  'sub_area_fias_id',
  'sub_area_kladr_id',
  'sub_area_type',
  'sub_area_type_full',
  'sub_area_with_type',
];

const ADDRESS_DATA_BRANCHES: ExpectedObjectBranch[] = [
  {
    ref: componentRef('AddressAdminData'),
    onlyProperties: ADMIN_DATA_ONLY_PROPERTIES,
    onlyRequired: ADMIN_DATA_ONLY_PROPERTIES,
  },
  {
    ref: componentRef('AddressMunicipalData'),
    onlyProperties: MUNICIPAL_DATA_ONLY_PROPERTIES,
    onlyRequired: [],
  },
];

const ADDRESS_SUGGESTION_BRANCHES: ExpectedObjectBranch[] = [
  emptyObjectBranch('AddressAdminSuggestion'),
  emptyObjectBranch('AddressMunicipalSuggestion'),
];

const ADDRESS_RESPONSE_BRANCHES: ExpectedObjectBranch[] = [
  emptyObjectBranch('SuggestAddressAdminResponse'),
  emptyObjectBranch('SuggestAddressMunicipalResponse'),
];

/**
 * DaData models cleaner subtypes as one generic `/clean/{type}` operation whose response is an
 * `anyOf`. Our spec exposes one concrete operation per subtype, so each projection explicitly
 * selects the matching official branch. The complete expected branch set makes this fail when
 * DaData adds, removes, or renames a cleaner subtype.
 */
const cleanerComparison: ComparisonConfig = {
  anyOfFolding: [],
  anyOfSelections: CLEANER_PATH_TYPES.map(([path, type]) => cleanerSelection(path, type)),
  schemaComponentAliases: Object.entries(CLEANER_ALIASES).map(
    ([sourceName, canonicalName]): SchemaComponentAliasRule => ({
      target: 'official',
      sourceName,
      canonicalName,
    }),
  ),
};

/**
 * Our address response is a precise admin/municipal union. The official spec exposes one broader
 * object shape. oasdiff does not compare those equivalent representations usefully, so the
 * comparison copy of our union is folded into their common object shape. Every allowed
 * branch-local difference and recursive merge is named here; unexpected divergence fails closed.
 */
const suggestionsComparison: ComparisonConfig = {
  anyOfFolding: [
    addressResponseFold('/suggest/address'),
    addressResponseFold('/geolocate/address'),
    addressResponseFold('/findById/address'),
    ipLocateAddressFold(),
  ],
  anyOfSelections: [],
  schemaComponentAliases: [],
};

export const OFFICIAL_FAMILY_CONFIGS: Record<OfficialFamily, OfficialFamilyConfig> = {
  cleaner: {
    family: 'cleaner',
    officialPathPrefix: '/api/v1',
    officialSourcePath: OFFICIAL_SOURCES.cleaner.localPath,
    snapshotPath: 'official/snapshots/cleaner.diff.txt',
    operations: {
      extensions: [],
      templateExpansions: templateExpansions(
        '/clean/{type}',
        CLEANER_PATH_TYPES.map(([path]) => path),
      ),
    },
    security: {
      // The cleaner source currently omits security although the API requires both credentials.
      whenOfficialUndeclared: API_AND_SECRET_KEY_SECURITY,
    },
    comparison: cleanerComparison,
  },
  profile: {
    family: 'profile',
    officialPathPrefix: '/api/v2',
    officialSourcePath: OFFICIAL_SOURCES.profile.localPath,
    snapshotPath: 'official/snapshots/profile.diff.txt',
    operations: {
      extensions: [],
      templateExpansions: [],
    },
    security: {
      // Profile methods normally require both credentials; `/version` is also available publicly.
      whenOfficialUndeclared: API_AND_SECRET_KEY_SECURITY,
      whenOfficialUndeclaredByPath: {
        '/version': [{ ApiKey: [] }, {}],
      },
    },
    comparison: EMPTY_COMPARISON,
  },
  suggestions: {
    family: 'suggestions',
    officialPathPrefix: '/api/4_1/rs',
    officialSourcePath: OFFICIAL_SOURCES.suggestions.localPath,
    snapshotPath: 'official/snapshots/suggestions.diff.txt',
    operations: {
      extensions: [extension('/iplocate/address', 'get')],
      templateExpansions: [
        ...templateExpansions('/findById/{name}', FIND_BY_ID_TEMPLATE_PATHS),
        ...templateExpansions('/geolocate/{name}', ['/geolocate/postal_unit']),
        ...templateExpansions('/suggest/{name}', SUGGEST_TEMPLATE_PATHS),
      ],
    },
    security: {
      // The suggestions source currently omits the API key requirement.
      whenOfficialUndeclared: API_KEY_SECURITY,
    },
    comparison: suggestionsComparison,
  },
};

function templateExpansions(pathTemplate: string, paths: string[]): TemplateExpansionMapping[] {
  return paths.map((path) => ({
    our: { path, method: 'post' },
    official: { pathTemplate, method: 'post' },
  }));
}

function extension(path: string, method: ExtensionMapping['our']['method']): ExtensionMapping {
  return { our: { path, method } };
}

function cleanerSelection(path: string, selectedType: string): AnyOfSelectionRule {
  return {
    target: 'official',
    operation: { path, method: 'post' },
    response: { status: '200', mediaType: 'application/json' },
    schemaPath: 'items',
    expectedBranchRefs: CLEANER_TYPES.map(componentRef),
    selectedRef: componentRef(selectedType),
  };
}

function addressResponseFold(path: string): AnyOfFoldingRule {
  return {
    target: 'ours',
    operation: { path, method: 'post' },
    response: { status: '200', mediaType: 'application/json' },
    schemaPath: '',
    expectedNullBranch: false,
    expectedObjectBranches: ADDRESS_RESPONSE_BRANCHES,
    allowedRecursiveMerges: [
      {
        schemaPath: 'properties/suggestions',
        kind: 'array',
        expectedBranchCount: 2,
        expectedBranchRefs: [],
      },
      {
        schemaPath: 'properties/suggestions/items',
        kind: 'object',
        expectedBranchRefs: ADDRESS_SUGGESTION_BRANCHES.map((branch) => branch.ref),
        expectedObjectBranches: ADDRESS_SUGGESTION_BRANCHES,
      },
      {
        schemaPath: 'properties/suggestions/items/properties/data',
        kind: 'object',
        expectedBranchRefs: ADDRESS_DATA_BRANCHES.map((branch) => branch.ref),
        expectedObjectBranches: ADDRESS_DATA_BRANCHES,
      },
    ],
  };
}

function ipLocateAddressFold(): AnyOfFoldingRule {
  return {
    target: 'ours',
    operation: { path: '/iplocate/address', method: 'post' },
    response: { status: '200', mediaType: 'application/json' },
    schemaPath: 'properties/location',
    expectedNullBranch: true,
    expectedObjectBranches: ADDRESS_SUGGESTION_BRANCHES,
    allowedRecursiveMerges: [
      {
        schemaPath: 'properties/data',
        kind: 'object',
        expectedBranchRefs: ADDRESS_DATA_BRANCHES.map((branch) => branch.ref),
        expectedObjectBranches: ADDRESS_DATA_BRANCHES,
      },
    ],
  };
}

function emptyObjectBranch(name: string): ExpectedObjectBranch {
  return {
    ref: componentRef(name),
    onlyProperties: [],
    onlyRequired: [],
  };
}

function componentRef(name: string): string {
  return `#/components/schemas/${name}`;
}
