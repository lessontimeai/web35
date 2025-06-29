async function llm_response(prompt){
    const generator = await pipeline('text-generation', 'Xenova/distilgpt2');
    const output = await generator(prompt);
    return output[0].generated_text;
}
