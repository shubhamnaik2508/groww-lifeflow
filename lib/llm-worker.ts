import {WebWorkerMLCEngineHandler} from '@mlc-ai/web-llm';

// Runs model download, tokenisation and inference off the main thread.
const handler=new WebWorkerMLCEngineHandler();
self.onmessage=(message:MessageEvent)=>handler.onmessage(message);
