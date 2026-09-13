/**
 * ADALAT360 - Asset Lifecycle Service
 * Police Asset Lifecycle Management with state machine, QR codes, and blockchain integration
 */
import { Asset, AssetStateHistoryEntry, AssetCreateRequest, AssetStateTransitionRequest, AssetQuery, AssetResponse, AssetStatistics, AssetQRScanResult, DisposalApproval, DisposalApprovalRequest } from '../models/asset-lifecycle.js';
export declare class AssetLifecycleService {
    createAsset(request: AssetCreateRequest, actorUserId: string): Promise<Asset>;
    transitionAssetState(request: AssetStateTransitionRequest, actorUserId: string): Promise<Asset>;
    createDisposalApproval(request: DisposalApprovalRequest, actorUserId: string): Promise<DisposalApproval>;
    approveDisposal(approvalId: string, approverUserId: string): Promise<DisposalApproval>;
    rejectDisposal(approvalId: string, approverUserId: string, reason: string): Promise<DisposalApproval>;
    private verifyDisposalApproval;
    scanAssetQR(qrPayloadString: string): Promise<AssetQRScanResult>;
    queryAssets(query: AssetQuery): Promise<AssetResponse>;
    getAsset(assetId: string): Promise<Asset | null>;
    getAssetByAssetId(assetId: string): Promise<Asset | null>;
    getAssetStateHistory(assetId: string): Promise<AssetStateHistoryEntry[]>;
    getAssetStatistics(caseId?: string): Promise<AssetStatistics>;
    private getTransitionType;
    private getCustodyActionForTransition;
    private verifyActorPermission;
    private getAssetIdentifier;
    private getAssetCaseId;
    private createNotification;
    checkExpiredDisposalApprovals(): Promise<number>;
    checkExpiredHandoffs(): Promise<number>;
}
export declare function getAssetLifecycleService(): AssetLifecycleService;
//# sourceMappingURL=asset-lifecycle.service.d.ts.map