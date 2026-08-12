import test from 'node:test';
import assert from 'node:assert/strict';
import { hasEntitledPlan, isEntitledAppInstance } from './entitlement.js';

test('entitles an app instance with an in-progress free trial', () => {
    assert.equal(isEntitledAppInstance({
        isFree: false,
        billing: { freeTrialInfo: { status: 'IN_PROGRESS' } }
    }), true);
});

test('entitles the basic1 package', () => {
    assert.equal(isEntitledAppInstance({
        isFree: false,
        billing: { packageName: 'basic1' }
    }), true);
});

test('rejects a free app instance', () => {
    assert.equal(isEntitledAppInstance({ isFree: true }), false);
});

test('rejects other paid packages', () => {
    assert.equal(isEntitledAppInstance({
        isFree: false,
        billing: { packageName: 'premium2' }
    }), false);
});

test('rejects ended and unavailable trials', () => {
    assert.equal(isEntitledAppInstance({
        billing: { freeTrialInfo: { status: 'ENDED' } }
    }), false);
    assert.equal(isEntitledAppInstance({
        billing: { freeTrialInfo: { status: 'NOT_AVAILABLE' } }
    }), false);
});

test('rejects missing billing data', () => {
    assert.equal(isEntitledAppInstance({ isFree: false }), false);
    assert.equal(isEntitledAppInstance(undefined), false);
});

test('looks up the app instance using metadata.instanceId', async () => {
    let requestedInstanceId;
    const entitled = await hasEntitledPlan(
        { instanceId: 'instance-123' },
        (instanceId) => {
            requestedInstanceId = instanceId;
            return {
                appInstances: {
                    getAppInstance: async () => ({
                        instance: { billing: { packageName: 'basic1' } }
                    })
                }
            };
        }
    );

    assert.equal(requestedInstanceId, 'instance-123');
    assert.equal(entitled, true);
});

test('fails closed when the app-instance lookup fails', async () => {
    const entitled = await hasEntitledPlan(
        { instanceId: 'instance-123' },
        () => ({
            appInstances: {
                getAppInstance: async () => {
                    throw new Error('lookup failed');
                }
            }
        })
    );

    assert.equal(entitled, false);
});

test('fails closed when metadata has no instance id', async () => {
    let called = false;
    const entitled = await hasEntitledPlan({}, () => {
        called = true;
        return {};
    });

    assert.equal(called, false);
    assert.equal(entitled, false);
});
