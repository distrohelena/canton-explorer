export type DecodeFailureReason =
  | 'missing_package'
  | 'invalid_package'
  | 'unknown_template'
  | 'unknown_choice'
  | 'unknown_data_type'
  | 'decode_failure';

export type DecodedDamlValue =
  | string
  | number
  | boolean
  | { kind: 'contract_id'; value: string }
  | { kind: 'record'; fields: Array<{ label: string; value: DecodedDamlValue }> }
  | { kind: 'variant'; constructor: string; value: DecodedDamlValue | null }
  | { kind: 'enum'; constructor: string }
  | { kind: 'list'; items: DecodedDamlValue[] }
  | { kind: 'optional'; value: DecodedDamlValue | null }
  | { kind: 'text_map'; entries: Array<{ key: string; value: DecodedDamlValue }> }
  | { kind: 'gen_map'; entries: Array<{ key: DecodedDamlValue; value: DecodedDamlValue }> }
  | { kind: 'unit' };

export type DecodeState<T> =
  | { status: 'decoded'; value: T }
  | { status: 'invalid_data'; reason: DecodeFailureReason }
  | { status: 'not_available' };

export interface ExerciseDecodeState {
  argument: DecodeState<DecodedDamlValue>;
  result: DecodeState<DecodedDamlValue>;
}
