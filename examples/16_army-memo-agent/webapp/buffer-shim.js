// Loaded first (esbuild --inject) so JSZip's platform check, which runs at
// module-load time, already sees a Buffer implementation.
import {Buffer} from "buffer";
globalThis.Buffer = Buffer;
