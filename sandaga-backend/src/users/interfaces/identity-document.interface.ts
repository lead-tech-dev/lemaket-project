import { IdentityDocumentType } from '../enums/identity-document-type.enum';

export type IdentityDocumentRecord = {
  id: string;
  type: IdentityDocumentType;
  url: string;
  uploadedAt: string;
  description?: string;
  reviewedAt?: string | null;
  reviewerId?: string | null;
  status?: 'pending' | 'approved' | 'rejected';
};
