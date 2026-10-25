import test from 'node:test';
import assert from 'node:assert/strict';
import {viewportMetrics} from '../public/viewport.js';
test('Safari keyboard follows the visual height and pan without leaving a gap',()=>{assert.deepEqual(viewportMetrics({height:406,layoutHeight:844,baselineHeight:844,offsetTop:44,focused:true}),{height:406,top:44,keyboard:true})});
test('Android resize-content keyboard is detected using the unfocused baseline',()=>{assert.equal(viewportMetrics({height:430,layoutHeight:430,baselineHeight:844,focused:true}).keyboard,true)});
test('dismissed keyboard ignores a stale Safari visual offset and restores full layout',()=>{assert.deepEqual(viewportMetrics({height:844,layoutHeight:844,baselineHeight:844,offsetTop:44,focused:false}),{height:844,top:0,keyboard:false})});
test('pinch zoom and hardware keyboard do not hide navigation',()=>{assert.equal(viewportMetrics({height:420,layoutHeight:844,baselineHeight:844,focused:true,scale:2}).keyboard,false);assert.equal(viewportMetrics({height:844,layoutHeight:844,baselineHeight:844,focused:true}).keyboard,false)});
