/**
 * FLOP Count Benchmarking with TensorFlow.js
 * This module provides utilities to benchmark floating-point operations
 * using TensorFlow.js for various neural network operations.
 */

// Import TensorFlow.js (assumes it's loaded via CDN or npm)
// For browser: <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js"></script>
// For Node.js: const tf = require('@tensorflow/tfjs');

/**
 * FLOP calculation utilities
 */
class FLOPCounter {
    /**
     * Estimate FLOPs for matrix multiplication
     * @param {Array} shapeA - Shape of matrix A [m, k]
     * @param {Array} shapeB - Shape of matrix B [k, n]
     * @returns {number} Estimated FLOP count
     */
    static matMulFLOPs(shapeA, shapeB) {
        const [m, k] = shapeA;
        const [k2, n] = shapeB;
        if (k !== k2) throw new Error('Matrix dimensions must be compatible');
        return 2 * m * n * k; // 2 operations per element: multiply + add
    }

    /**
     * Estimate FLOPs for convolution operation
     * @param {Array} inputShape - [batch, height, width, channels]
     * @param {Array} kernelShape - [kernelHeight, kernelWidth, inputChannels, outputChannels]
     * @param {Array} outputShape - [batch, outputHeight, outputWidth, outputChannels]
     * @returns {number} Estimated FLOP count
     */
    static conv2dFLOPs(inputShape, kernelShape, outputShape) {
        const [, outputHeight, outputWidth, outputChannels] = outputShape;
        const [kernelHeight, kernelWidth, inputChannels] = kernelShape;
        
        return 2 * outputHeight * outputWidth * outputChannels * 
               kernelHeight * kernelWidth * inputChannels;
    }

    /**
     * Estimate FLOPs for activation functions (approximation)
     * @param {number} numElements - Number of elements
     * @returns {number} Estimated FLOP count
     */
    static activationFLOPs(numElements) {
        return numElements; // Approximation: 1 FLOP per element
    }

    /**
     * Calculate total elements in a tensor shape
     * @param {Array} shape - Tensor shape
     * @returns {number} Total number of elements
     */
    static totalElements(shape) {
        return shape.reduce((acc, dim) => acc * dim, 1);
    }
}

/**
 * Benchmarking utilities
 */
class TensorFlowBenchmark {
    constructor() {
        this.results = [];
    }

    /**
     * Benchmark matrix multiplication operations
     * @param {Array} sizes - Array of matrix sizes to test [[m, k, n], ...]
     * @param {number} warmupRuns - Number of warmup runs
     * @param {number} benchmarkRuns - Number of benchmark runs
     * @returns {Promise<Object>} Benchmark results
     */
    async benchmarkMatMul(sizes = [[512, 512, 512], [1024, 1024, 1024], [2048, 1024, 512]], 
                         warmupRuns = 5, benchmarkRuns = 10) {
        const results = [];

        for (const [m, k, n] of sizes) {
            console.log(`Benchmarking MatMul: ${m}x${k} * ${k}x${n}`);
            
            // Create random tensors
            const a = tf.randomNormal([m, k]);
            const b = tf.randomNormal([k, n]);
            
            // Warmup
            for (let i = 0; i < warmupRuns; i++) {
                const result = tf.matMul(a, b);
                await result.data();
                result.dispose();
            }

            // Benchmark
            const times = [];
            for (let i = 0; i < benchmarkRuns; i++) {
                const startTime = performance.now();
                const result = tf.matMul(a, b);
                await result.data(); // Ensure operation completes
                const endTime = performance.now();
                
                times.push(endTime - startTime);
                result.dispose();
            }

            const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
            const estimatedFLOPs = FLOPCounter.matMulFLOPs([m, k], [k, n]);
            const gflops = (estimatedFLOPs / (avgTime / 1000)) / 1e9;

            results.push({
                operation: 'MatMul',
                shape: `${m}x${k} * ${k}x${n}`,
                avgTimeMs: avgTime,
                estimatedFLOPs: estimatedFLOPs,
                gflops: gflops
            });

            // Cleanup
            a.dispose();
            b.dispose();
        }

        return results;
    }

    /**
     * Benchmark convolution operations
     * @param {Array} configs - Array of conv configs [{inputShape, kernelShape, ...}, ...]
     * @param {number} warmupRuns - Number of warmup runs
     * @param {number} benchmarkRuns - Number of benchmark runs
     * @returns {Promise<Object>} Benchmark results
     */
    async benchmarkConv2D(configs = [
        { inputShape: [1, 224, 224, 3], kernelShape: [3, 3, 3, 64], strides: 1, padding: 'same' },
        { inputShape: [1, 112, 112, 64], kernelShape: [3, 3, 64, 128], strides: 1, padding: 'same' },
        { inputShape: [1, 56, 56, 128], kernelShape: [3, 3, 128, 256], strides: 1, padding: 'same' }
    ], warmupRuns = 3, benchmarkRuns = 5) {
        const results = [];

        for (const config of configs) {
            const { inputShape, kernelShape, strides, padding } = config;
            console.log(`Benchmarking Conv2D: input=${inputShape.join('x')}, kernel=${kernelShape.join('x')}`);

            // Create random tensors
            const input = tf.randomNormal(inputShape);
            const kernel = tf.randomNormal(kernelShape);

            // Warmup
            for (let i = 0; i < warmupRuns; i++) {
                const result = tf.conv2d(input, kernel, strides, padding);
                await result.data();
                result.dispose();
            }

            // Benchmark
            const times = [];
            for (let i = 0; i < benchmarkRuns; i++) {
                const startTime = performance.now();
                const result = tf.conv2d(input, kernel, strides, padding);
                await result.data();
                const endTime = performance.now();
                
                times.push(endTime - startTime);
                
                // Calculate output shape for FLOP estimation
                const outputShape = result.shape;
                const estimatedFLOPs = FLOPCounter.conv2dFLOPs(inputShape, kernelShape, outputShape);
                
                if (i === 0) { // Store FLOP info on first run
                    results.push({
                        operation: 'Conv2D',
                        inputShape: inputShape.join('x'),
                        kernelShape: kernelShape.join('x'),
                        outputShape: outputShape.join('x'),
                        estimatedFLOPs: estimatedFLOPs
                    });
                }
                
                result.dispose();
            }

            const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
            const gflops = (results[results.length - 1].estimatedFLOPs / (avgTime / 1000)) / 1e9;
            
            results[results.length - 1].avgTimeMs = avgTime;
            results[results.length - 1].gflops = gflops;

            // Cleanup
            input.dispose();
            kernel.dispose();
        }

        return results;
    }

    /**
     * Benchmark a simple neural network forward pass
     * @param {Array} layerSizes - Array of layer sizes [input, hidden1, hidden2, ..., output]
     * @param {number} batchSize - Batch size for the benchmark
     * @param {number} runs - Number of benchmark runs
     * @returns {Promise<Object>} Benchmark results
     */
    async benchmarkNeuralNetwork(layerSizes = [784, 512, 256, 10], batchSize = 32, runs = 10) {
        console.log(`Benchmarking Neural Network: ${layerSizes.join(' -> ')}, batch size: ${batchSize}`);

        // Create model
        const model = tf.sequential();
        
        for (let i = 0; i < layerSizes.length - 1; i++) {
            model.add(tf.layers.dense({
                units: layerSizes[i + 1],
                inputShape: i === 0 ? [layerSizes[i]] : undefined,
                activation: i === layerSizes.length - 2 ? 'softmax' : 'relu'
            }));
        }

        // Create input data
        const input = tf.randomNormal([batchSize, layerSizes[0]]);

        // Warmup
        for (let i = 0; i < 3; i++) {
            const result = model.predict(input);
            await result.data();
            result.dispose();
        }

        // Benchmark
        const times = [];
        let totalFLOPs = 0;

        for (let i = 0; i < runs; i++) {
            const startTime = performance.now();
            const result = model.predict(input);
            await result.data();
            const endTime = performance.now();
            
            times.push(endTime - startTime);
            result.dispose();
        }

        // Estimate total FLOPs
        for (let i = 0; i < layerSizes.length - 1; i++) {
            totalFLOPs += FLOPCounter.matMulFLOPs([batchSize, layerSizes[i]], [layerSizes[i], layerSizes[i + 1]]);
            totalFLOPs += FLOPCounter.activationFLOPs(batchSize * layerSizes[i + 1]);
        }

        const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
        const gflops = (totalFLOPs / (avgTime / 1000)) / 1e9;

        // Cleanup
        input.dispose();
        model.dispose();

        return {
            operation: 'Neural Network Forward Pass',
            architecture: layerSizes.join(' -> '),
            batchSize: batchSize,
            avgTimeMs: avgTime,
            estimatedFLOPs: totalFLOPs,
            gflops: gflops
        };
    }

    /**
     * Run comprehensive FLOP benchmarks
     * @param {Object} options - Benchmark options
     * @returns {Promise<Object>} Complete benchmark results
     */
    async runComprehensiveBenchmark(options = {}) {
        const {
            includeMatMul = true,
            includeConv2D = true,
            includeNeuralNet = true,
            verbose = true
        } = options;

        console.log('Starting TensorFlow.js FLOP Benchmark...');
        console.log(`TensorFlow.js version: ${tf.version.tfjs}`);
        console.log(`Backend: ${tf.getBackend()}`);
        console.log('='.repeat(50));

        const results = {
            metadata: {
                timestamp: new Date().toISOString(),
                tfVersion: tf.version.tfjs,
                backend: tf.getBackend(),
                platform: typeof window !== 'undefined' ? 'browser' : 'node'
            },
            benchmarks: {}
        };

        try {
            if (includeMatMul) {
                console.log('\n🔸 Running Matrix Multiplication Benchmarks...');
                results.benchmarks.matMul = await this.benchmarkMatMul();
                if (verbose) this.printResults(results.benchmarks.matMul, 'Matrix Multiplication');
            }

            if (includeConv2D) {
                console.log('\n🔸 Running Convolution Benchmarks...');
                results.benchmarks.conv2d = await this.benchmarkConv2D();
                if (verbose) this.printResults(results.benchmarks.conv2d, 'Convolution');
            }

            if (includeNeuralNet) {
                console.log('\n🔸 Running Neural Network Benchmarks...');
                results.benchmarks.neuralNet = await this.benchmarkNeuralNetwork();
                if (verbose) this.printResults([results.benchmarks.neuralNet], 'Neural Network');
            }

        } catch (error) {
            console.error('Benchmark error:', error);
            results.error = error.message;
        }

        console.log('\n' + '='.repeat(50));
        console.log('Benchmark completed!');

        return results;
    }

    /**
     * Print benchmark results in a formatted table
     * @param {Array} results - Benchmark results
     * @param {string} title - Title for the results
     */
    printResults(results, title) {
        console.log(`\n📊 ${title} Results:`);
        console.log('-'.repeat(80));
        console.log('Operation'.padEnd(20) + 'Shape/Config'.padEnd(25) + 'Time (ms)'.padEnd(12) + 'GFLOPS'.padEnd(10));
        console.log('-'.repeat(80));

        results.forEach(result => {
            const op = result.operation.padEnd(20);
            const shape = (result.shape || result.inputShape || result.architecture || 'N/A').padEnd(25);
            const time = result.avgTimeMs.toFixed(2).padEnd(12);
            const gflops = result.gflops.toFixed(2);
            console.log(`${op}${shape}${time}${gflops}`);
        });
    }
}

/**
 * Convenience function to run a quick FLOP benchmark
 * @param {Object} options - Benchmark options
 * @returns {Promise<Object>} Benchmark results
 */
async function runFLOPBenchmark(options = {}) {
    // Ensure TensorFlow.js is available
    if (typeof tf === 'undefined') {
        throw new Error('TensorFlow.js is not loaded. Please include TensorFlow.js before running benchmarks.');
    }

    const benchmark = new TensorFlowBenchmark();
    return await benchmark.runComprehensiveBenchmark(options);
}

// Export for use in both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FLOPCounter, TensorFlowBenchmark, runFLOPBenchmark };
} else if (typeof window !== 'undefined') {
    window.FLOPCounter = FLOPCounter;
    window.TensorFlowBenchmark = TensorFlowBenchmark;
    window.runFLOPBenchmark = runFLOPBenchmark;
}
