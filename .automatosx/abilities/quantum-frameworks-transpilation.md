# Quantum Frameworks & Transpilation

## Overview

Leverage Qiskit, Cirq, and related toolchains to build quantum circuits,
perform transpilation and optimization passes, and tailor executions to
specific backend topologies and calibration data for maximal performance.

## Core Concepts & Best Practices

- **Circuit Abstraction**: Separate algorithm logic from backend configuration
  using parameterized circuits and modular subroutines.
- **Compilation Stages**: Understand high-level synthesis, basis translation,
  layout selection, and scheduling; tune each stage for depth and fidelity.
- **Hardware Awareness**: Align qubit allocation with device coupling maps and
  apply gate direction corrections plus SWAP insertion strategies judiciously.
- **Optimization Heuristics**: Employ gate cancellation, commutation analysis,
  and resynthesis passes; iterate on pass managers to hit depth or width
  targets.
- **Calibration Integration**: Consume backend calibration data (gate errors,
  T1/T2, readout errors) to inform transpiler cost models and pulse-level
  adjustments.

## Tools & Methodologies

- **Qiskit Workflow**: Use `QuantumCircuit`, `transpile`, and `PassManager`
  with custom passes; export to QASM or pulse schedules when required.
- **Cirq Workflow**: Build `Circuit` objects with PhasedFSim gates, optimize
  via `cirq.optimize_for_target_gateset`, and serialize using `cirq.to_json`.
- **Cross-Framework Interop**: Convert circuits via `qasm3` or `tket` bridges
  for comparative benchmarking.
- **Pulse-Level Control**: Employ Qiskit Pulse or Cirq’s `pulses` module for
  custom calibrations and dynamical decoupling sequences.
- **Automation Pipelines**: Script transpilation sweeps across optimization
  levels, collect performance metrics, and store build artifacts for
  reproducibility.

## Example Scenario

An R&D team migrates a chemistry VQE circuit to new superconducting hardware.
They create a custom Qiskit `PassManager` that performs layout selection via
SABRE, enables commutation-aware gate cancellations, and inserts echoed
cross-resonance calibrations, cutting circuit depth by 27% while preserving
expected energy accuracy.

## Reference Resources

- Qiskit Documentation: <https://qiskit.org/documentation>
- Cirq Documentation: <https://quantumai.google/cirq>
- Murali et al., “Noise-Adaptive Compiler Mappings for Noisy
  Intermediate-Scale Quantum Computers,” *ASPLOS* (2019)
- Cowtan et al., “On the Qubit Routing Problem,” *ACM TECS* (2020)
- TKET Compiler: <https://cqcl.github.io/tket/pytket/api>
