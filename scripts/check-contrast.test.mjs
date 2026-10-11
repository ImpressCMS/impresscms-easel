import assert from 'node:assert/strict'
import { test } from 'node:test'
import { contrast } from './color.mjs'

test('black on white is 21:1', () => {
    assert.equal(Math.round(contrast('#000000', '#ffffff')), 21)
})

test('the order of the colours does not matter', () => {
    assert.equal(contrast('#0b5cad', '#ffffff'), contrast('#ffffff', '#0b5cad'))
})

test('matches the ratios of the WCAG reference colours', () => {
    assert.equal(contrast('#767676', '#ffffff').toFixed(2), '4.54')
    assert.equal(contrast('#777777', '#ffffff').toFixed(2), '4.48')
    assert.equal(contrast('#949494', '#ffffff').toFixed(2), '3.03')
})

test('accepts short hex colours', () => {
    assert.equal(contrast('#fff', '#000').toFixed(0), '21')
})
