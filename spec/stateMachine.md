# State Machine Model

# Bond

## Not created

- Allowed addresses can create a bond and move to "Not fully paid and not matured"

## Not fully paid and not matured

- When maturity date passes move to "Not fully paid and matured"
- Owner can fully pay and move to "Fully paid and not matured"

## Fully paid and not matured

- When maturity date passes move to "Fully paid and matured"

## Not fully paid and matured

- This state is terminal (no more transitions are possible)

## Fully paid and matured

- This state is terminal (no more transitions are possible)

# State Modifications

Output from slithers `vars-and-auth` @ commit https://github.com/porter-finance/v1-core/commit/6f810e576c26e272c08bbadd5cae7ee3b6c3930d

<img width="1431" alt="image" src="https://user-images.githubusercontent.com/15036618/159794711-3c244724-ca4b-49a6-b515-c69a5c6ec0e6.png">

<img width="671" alt="image" src="https://user-images.githubusercontent.com/15036618/159794739-1fc7f812-93e1-42fc-8313-523a09b978cd.png">
