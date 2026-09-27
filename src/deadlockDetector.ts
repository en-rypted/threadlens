import { ThreadInfo } from './parser';

export interface DeadlockInfo {
    cycle: ThreadInfo[];
}

export function detectDeadlocks(threads: ThreadInfo[]): DeadlockInfo[] {
    const deadlocks: DeadlockInfo[] = [];
    const lockToOwner = new Map<string, ThreadInfo>();
    
    // Build a map of which thread holds which lock
    for (const thread of threads) {
        for (const lock of thread.locksHeld) {
            lockToOwner.set(lock, thread);
        }
    }
    
    const processedCycleKeys = new Set<string>();
    
    // Trace paths from every thread to find cycles
    for (const startThread of threads) {
        let currentThread: ThreadInfo | undefined = startThread;
        const currentPath: ThreadInfo[] = [];
        const currentPathNids = new Set<string>();
        
        while (currentThread) {
            if (currentPathNids.has(currentThread.nid)) {
                // Cycle found!
                const cycleStartIndex = currentPath.findIndex(t => t.nid === currentThread!.nid);
                const cycle = currentPath.slice(cycleStartIndex);
                
                // Use a sorted list of NIDs to uniquely identify this cycle
                const cycleKey = cycle.map(t => t.nid).sort().join(',');
                if (!processedCycleKeys.has(cycleKey)) {
                    deadlocks.push({ cycle });
                    processedCycleKeys.add(cycleKey);
                }
                break;
            }
            
            currentPath.push(currentThread);
            currentPathNids.add(currentThread.nid);
            
            // Follow what this thread is waiting for
            let nextLock = currentThread.waitingOnLock || currentThread.waitingToLock;
            if (nextLock) {
                currentThread = lockToOwner.get(nextLock);
            } else {
                currentThread = undefined;
            }
        }
    }
    
    return deadlocks;
}
