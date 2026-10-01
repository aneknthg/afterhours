/**
 * LivenessCheck.jsx
 *
 * Thin wrapper around AWS Amplify's FaceLivenessDetector. Used in two places:
 *   - VerificationModal, inline, for people verifying on the website
 *   - pages/Liveness.jsx, standalone, for the mobile app's in-app browser handoff
 *
 * The component streams challenge video straight from the browser to Rekognition
 * over a signed WebSocket, which is why it needs real AWS credentials. Those come
 * from the verify-identity edge function as 15-minute AssumeRole credentials
 * scoped by an inline session policy to rekognition:StartFaceLivenessSession and
 * nothing else — see the function header for why we don't ship the IAM user key.
 *
 * Nothing here decides whether the user passed. onAnalysisComplete only means the
 * challenge finished; the verdict comes from the server calling
 * GetFaceLivenessSessionResults. A client that lies about completion just gets a
 * failed result back.
 */
import { FaceLivenessDetector } from '@aws-amplify/ui-react-liveness';
import '@aws-amplify/ui-react/styles.css';

export default function LivenessCheck({ sessionId, region, credentials, onComplete, onError, onCancel }) {
  return (
    // No `overflow-hidden` here, deliberately. The light challenge paints through
    // `.amplify-liveness-freshness-canvas`, which is `position: fixed` at 100vw/100vh
    // so the colour covers the whole viewport. Clipping it to a rounded card leaves
    // the flash filling only part of the screen, which reads as a rendering bug.
    // Rounding the corners here costs the full-bleed flash — it isn't worth it.
    <div className="bg-surface-container rounded-2xl">
      <FaceLivenessDetector
        sessionId={sessionId}
        region={region}
        config={{
          // Amplify calls this whenever it needs to sign a request. We hand back the
          // credentials the edge function already minted rather than wiring up a
          // Cognito identity pool, which Afterhours doesn't otherwise use.
          credentialProvider: async () => ({
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken,
            expiration: credentials.expiration ? new Date(credentials.expiration) : undefined,
          }),
        }}
        onAnalysisComplete={onComplete}
        onError={onError}
        onUserCancel={onCancel}
        displayText={{
          hintCenterFaceText: 'Center your face',
          startScreenBeginCheckText: 'Begin check',
          photosensitivityWarningHeadingText: 'Photosensitivity warning',
          photosensitivityWarningBodyText:
            'This check flashes bright coloured lights. Do not continue if you have '
            + 'photosensitive epilepsy or are sensitive to flashing light.',
        }}
      />
    </div>
  );
}
