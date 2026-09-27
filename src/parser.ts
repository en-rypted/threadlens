export interface ThreadInfo {
    name: string;
    nid: string;
    tid: string;
    state: string;
    daemon: boolean;
    stackTrace: string[];
    locksHeld: string[];
    waitingOnLock: string | null;
    waitingToLock: string | null;
    rawBlock: string;
}

export function parseThreadDump(text: string): ThreadInfo[] {
    const threads: ThreadInfo[] = [];
    
    // Split by double newline or similar block separators.
    const blocks = text.split(/\r?\n\r?\n/);
    
    for (const block of blocks) {
        if (block.trim() === '') continue;
        
        // A valid thread block typically starts with a quote for the thread name
        if (block.startsWith('"')) {
            const lines = block.split(/\r?\n/);
            const headerLine = lines[0];
            
            const nameMatch = headerLine.match(/"(.*?)"/);
            const name = nameMatch ? nameMatch[1] : 'Unknown';
            
            const nidMatch = headerLine.match(/nid=(0x[0-9a-fA-F]+|\d+)/);
            const nid = nidMatch ? nidMatch[1] : '';
            
            const tidMatch = headerLine.match(/tid=(0x[0-9a-fA-F]+|\d+)/);
            const tid = tidMatch ? tidMatch[1] : '';
            
            const daemon = headerLine.includes(' daemon ');
            
            let state = 'UNKNOWN';
            const stackTrace: string[] = [];
            const locksHeld: string[] = [];
            let waitingOnLock: string | null = null;
            let waitingToLock: string | null = null;
            
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith('java.lang.Thread.State:')) {
                    state = line.split(':')[1].trim();
                } else if (line.startsWith('at ')) {
                    stackTrace.push(line.substring(3).trim());
                } else if (line.startsWith('- locked <')) {
                    const lockMatch = line.match(/- locked <(0x[0-9a-fA-F]+)>/);
                    if (lockMatch) locksHeld.push(lockMatch[1]);
                } else if (line.startsWith('- waiting on <')) {
                    const lockMatch = line.match(/- waiting on <(0x[0-9a-fA-F]+)>/);
                    if (lockMatch) waitingOnLock = lockMatch[1];
                } else if (line.startsWith('- waiting to lock <')) {
                    const lockMatch = line.match(/- waiting to lock <(0x[0-9a-fA-F]+)>/);
                    if (lockMatch) waitingToLock = lockMatch[1];
                }
            }
            
            // Fallback for state if it wasn't on a dedicated line
            if (state === 'UNKNOWN' && headerLine.toLowerCase().includes('runnable')) {
                state = 'RUNNABLE';
            }
            
            threads.push({
                name,
                nid,
                tid,
                state,
                daemon,
                stackTrace,
                locksHeld,
                waitingOnLock,
                waitingToLock,
                rawBlock: block
            });
        }
    }
    
    return threads;
}
