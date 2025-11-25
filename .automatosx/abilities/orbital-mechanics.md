# Orbital Mechanics

## Overview

Analyze orbital dynamics for spacecraft, including multi-body perturbations,
station-keeping strategies, and maneuver planning that respects mission
constraints, propellant budgets, and operational safety.

## Core Concepts & Best Practices

- **Two-Body Foundations**: Master Keplerian elements, conic sections, Lambert
  targeting, and orbital perturbation theory.
- **Perturbation Modeling**: Incorporate J2 oblateness, atmospheric drag, solar
  radiation pressure, and third-body effects in long-duration analyses.
- **Maneuver Planning**: Design Hohmann, bi-elliptic, low-thrust, and
  plane-change maneuvers; evaluate trade-offs between time, delta-v, and risk.
- **Relative Motion**: Apply Clohessy-Wiltshire and Tschauner-Hempel equations
  for rendezvous; integrate collision avoidance envelopes.
- **Station-Keeping**: Develop periodic correction strategies for GEO, LEO
  constellations, and Lagrange point orbits while balancing propellant and
  pointing needs.

## Tools & Methodologies

- **Numerical Propagators**: Use GMAT, Orekit, STK, Basilisk, or custom
  Runge-Kutta integrators with event detection for shadow entry or exit.
- **Astrodynamics Libraries**: Leverage poliastro, NASA GMAT API, and JPL SPICE
  kernels for ephemeris and frame transformations.
- **Optimization Routines**: Employ differential correction, sequential
  quadratic programming, or heuristic search for multi-burn sequences.
- **Monte Carlo Analysis**: Simulate maneuver execution dispersions and
  environmental uncertainties to bound state covariance growth.
- **Validation & Verification**: Cross-check analytical solutions with
  high-fidelity propagators; maintain traceability of gravitational models and
  reference frames.

## Example Scenario

A mission team plans a lunar orbit insertion. They run Lambert targeting from
translunar injection to perilune, account for Earth-Moon three-body
perturbations using GMAT, and apply sequential quadratic programming to
minimize delta-v while satisfying lighting constraints for optical navigation.

## Reference Resources

- Vallado, *Fundamentals of Astrodynamics and Applications*, Microcosm Press
- Curtis, *Orbital Mechanics for Engineering Students*, Butterworth-Heinemann
- NASA GMAT User Guide: <https://gmatcentral.org>
- Orekit Documentation: <https://www.orekit.org>
- JPL SPICE Toolkit: <https://naif.jpl.nasa.gov/naif/toolkit.html>
