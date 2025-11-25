# Propulsion Systems

## Overview

Engineer and evaluate spacecraft propulsion systems, encompassing chemical and
electric propulsion performance envelopes, reliability modeling, and
integration with vehicle architecture and mission requirements.

## Core Concepts & Best Practices

- **Propulsion Taxonomy**: Compare bipropellant, monopropellant, solid,
  hybrid, electric (Hall, ion, MPD), and advanced concepts (nuclear thermal,
  solar sail).
- **Performance Metrics**: Calculate specific impulse, thrust-to-weight, mass
  flow, and efficiency; assess throttling capability and response time.
- **System Integration**: Design feed systems (pressurization, valves,
  regulators), thermal management, and structural interfaces with redundancy.
- **Reliability Modeling**: Apply fault tree analysis, Weibull statistics, and
  Bayesian updating to predict MTBF and mission success probabilities.
- **Contamination & Plume Effects**: Model plume impingement, erosion, and
  electromagnetic interference on spacecraft subsystems.

## Tools & Methodologies

- **Analysis Suites**: Use NASA CEA, RPA, or in-house CFD tools for combustion
  and nozzle performance prediction.
- **Electric Propulsion Modeling**: Employ Hall thruster simulators, ion optics
  codes, and particle-in-cell (PIC) methods to analyze plasma behavior.
- **System Sizing**: Develop Excel, Modelica, or Amesim models for propellant
  budget, tank sizing, and pressurization cycles.
- **Test Campaign Planning**: Define hot-fire, vibration, thermal vacuum, and
  life tests; collect telemetry for model correlation.
- **Verification & Validation**: Execute acceptance test procedures (ATP) and
  qualification plans while enforcing strict configuration control.

## Example Scenario

A GEO comsat program selects a hybrid propulsion architecture: chemical
thrusters for orbit raising and Hall-effect thrusters for station-keeping.
Engineers use NASA CEA to size bipropellant engines, run PIC simulations to
verify Hall thruster plume interactions, and apply reliability block diagrams
to ensure mission lifetime exceeds 15 years with 0.98 probability.

## Reference Resources

- Sutton & Biblarz, *Rocket Propulsion Elements*, Wiley
- Humble, Henry & Larson, *Space Propulsion Analysis and Design*, McGraw-Hill
- Goebel & Katz, *Fundamentals of Electric Propulsion*, JPL/NASA
- NASA Chemical Equilibrium with Applications (CEA): <https://cearun.grc.nasa.gov>
- AIAA Propulsion and Energy Forum Proceedings
