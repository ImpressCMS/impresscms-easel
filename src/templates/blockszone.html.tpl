<{if $blocks}>
<div class="zone">
    <{foreach from=$blocks item=block}>
    <section class="block block-<{$block.module}>"<{if $block.title}> aria-labelledby="block-<{$block.id}>-title"<{/if}>>
        <{if $block.title}>
        <h2 class="block-title" id="block-<{$block.id}>-title"><{$block.title}></h2>
        <{/if}>
        <div class="block-content"><{$block.content}></div>
    </section>
    <{/foreach}>
</div>
<{/if}>
