import { Resend } from 'resend';
import { apiError } from '../utils/apiError.js';

let resend = null;

const getResendClient = () => {
  if (!resend) {
    resend = new Resend(process.env.EMAIL_SEND_KEY);
  }
  return resend;
};

export const sendEmail = async ({ sendTo, subject, html }) => {
  try {
    const client = getResendClient();
    const { data, error } = await client.emails.send({
      from: 'Zafgoal <no-reply@alphacryptvpn.com>',
      to: sendTo,
      subject,
      html,
    });

    if (error) {
      return console.log({ error });
    }

    return data;
  } catch (error) {
    console.log('Error in sendEmail Service: ', error);
    throw new apiError(500, 'Send email is failed', false, error.message);
  }
};
