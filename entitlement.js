const ACTIVE_FREE_TRIAL_STATUS = 'IN_PROGRESS';
const ENTITLED_PACKAGE_NAME = 'basic1';

export function isEntitledAppInstance(instance) {
    return instance?.billing?.freeTrialInfo?.status === ACTIVE_FREE_TRIAL_STATUS
        || instance?.billing?.packageName === ENTITLED_PACKAGE_NAME;
}

export async function hasEntitledPlan(metadata, clientFactory) {
    const instanceId = metadata?.instanceId;

    if (!instanceId) {
        console.warn('[entitlement] Missing metadata.instanceId; denying additional fees');
        return false;
    }

    try {
        console.log(`[entitlement] Looking up app instance: ${instanceId}`);
        const client = clientFactory(instanceId);
        const response = await client.appInstances.getAppInstance();
        const instance = response?.instance;
        const trialStatus = instance?.billing?.freeTrialInfo?.status;
        const packageName = instance?.billing?.packageName;
        const entitled = isEntitledAppInstance(instance);

        console.log('[entitlement] App instance plan resolved:', {
            instanceId,
            isFree: instance?.isFree,
            trialStatus,
            packageName,
            entitled
        });

        return entitled;
    } catch (error) {
        console.error('[entitlement] App-instance lookup failed; denying additional fees:', {
            instanceId,
            error: error?.message || String(error)
        });
        return false;
    }
}
