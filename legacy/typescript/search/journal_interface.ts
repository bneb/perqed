
export interface Journal {
  record(obs: string): void;
  addEntry?(entry: any): Promise<void>;
}
