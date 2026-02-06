"""
Freepik API Service for Generating Chemical Reaction Images.

Generates visual representations of drug interactions and chemical reactions.
Uses the Freepik Mystic API for AI image generation.
"""
import logging
import asyncio
from typing import Optional
import httpx
from config import FREEPIK_API_KEY

logger = logging.getLogger(__name__)

# Freepik Mystic API endpoint (correct endpoint per docs)
FREEPIK_API_URL = "https://api.freepik.com/v1/ai/mystic"

# Chemical reaction prompt templates
REACTION_PROMPT_TEMPLATES = [
    "Scientific chemistry diagram showing chemical reaction between {drug1} ({formula1}) and {drug2} ({formula2}), molecular structures with atoms and bonds, reaction arrows, white background, professional pharmaceutical illustration, high resolution, detailed structural formulas",
    "Pharmacokinetic interaction visualization between {drug1} and {drug2}, chemical formulas {formula1} + {formula2}, molecular binding process, drug interaction mechanism, scientific medical illustration, detailed chemical structures, reaction pathway diagram",
    "Drug-drug interaction molecular diagram: {drug1} + {drug2} reaction pathway, showing structures for {formula1} and {formula2}, chemical transformation visualization, metabolic interaction mechanism, detailed structural formulas",
]


class FreepikService:
    """Service for generating chemical reaction images using Freepik Mystic AI."""

    @staticmethod
    def _get_headers() -> dict:
        """Get headers for Freepik API requests."""
        return {
            "x-freepik-api-key": FREEPIK_API_KEY,  # Correct header per docs
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    @classmethod
    async def _poll_task_status(cls, task_id: str, client: httpx.AsyncClient, max_attempts: int = 30) -> Optional[str]:
        """Poll the task status until complete or timeout."""
        status_url = f"https://api.freepik.com/v1/ai/mystic/{task_id}"
        
        for attempt in range(max_attempts):
            await asyncio.sleep(2)  # Wait 2 seconds between polls
            
            try:
                response = await client.get(status_url, headers=cls._get_headers())
                
                if response.status_code != 200:
                    logger.warning(f"Poll attempt {attempt + 1}: status {response.status_code}")
                    continue
                
                data = response.json()
                status = data.get("data", {}).get("status", "")
                
                if status == "COMPLETED":
                    generated = data.get("data", {}).get("generated", [])
                    if generated and len(generated) > 0:
                        return generated[0].get("url")
                    return None
                elif status == "FAILED":
                    logger.error(f"Freepik task failed: {data}")
                    return None
                    
                logger.debug(f"Task {task_id} status: {status}, attempt {attempt + 1}")
                
            except Exception as e:
                logger.warning(f"Poll error: {e}")
                continue
        
        logger.warning(f"Task {task_id} timed out after {max_attempts} attempts")
        return None

    @classmethod
    async def generate_reaction_image(
        cls,
        drug1: str,
        drug2: str,
        drug1_formula: str = "",
        drug2_formula: str = "",
        mechanism: Optional[str] = None,
        style: str = "scientific"
    ) -> Optional[str]:
        """
        Generate a chemical reaction image for drug interaction.

        Args:
            drug1: Name of first drug
            drug2: Name of second drug
            drug1_formula: Chemical formula of first drug
            drug2_formula: Chemical formula of second drug
            mechanism: Optional mechanism description
            style: Image style (scientific, realistic, diagram)

        Returns:
            URL of generated image, or None if generation failed
        """
        if not FREEPIK_API_KEY:
            logger.warning("FREEPIK_API_KEY not configured")
            return None

        # Build the prompt
        f1 = f"formula {drug1_formula}" if drug1_formula else "molecular structure"
        f2 = f"formula {drug2_formula}" if drug2_formula else "molecular structure"
        
        prompt = REACTION_PROMPT_TEMPLATES[0].format(
            drug1=drug1, 
            drug2=drug2,
            formula1=f1,
            formula2=f2
        )
        if mechanism:
            prompt += f", showing {mechanism}"

        logger.info(f"Generating image with prompt: {prompt[:100]}...")

        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                # Initial request to start generation
                response = await client.post(
                    FREEPIK_API_URL,
                    headers=cls._get_headers(),
                    json={
                        "prompt": prompt,
                        "aspect_ratio": "square_1_1",
                        "model": "realism",  # Best for scientific diagrams
                        "filter_nsfw": True
                    }
                )

                if response.status_code not in [200, 202]:
                    logger.error(f"Freepik API error: {response.status_code} - {response.text}")
                    return None

                data = response.json()
                logger.debug(f"Initial response: {data}")

                # Check if we got an immediate result or need to poll
                status = data.get("data", {}).get("status", "")
                
                if status == "COMPLETED":
                    # Immediate result
                    generated = data.get("data", {}).get("generated", [])
                    if generated and len(generated) > 0:
                        image_url = generated[0].get("url")
                        logger.info(f"Generated reaction image for {drug1} + {drug2}")
                        return image_url
                
                elif status == "IN_PROGRESS":
                    # Need to poll for result
                    task_id = data.get("data", {}).get("task_id")
                    if task_id:
                        logger.info(f"Polling task {task_id} for result...")
                        return await cls._poll_task_status(task_id, client)
                
                logger.warning(f"Unexpected response format: {data}")
                return None

        except asyncio.TimeoutError:
            logger.error("Freepik API request timed out")
            return None
        except Exception as e:
            logger.error(f"Error generating reaction image: {e}")
            return None

    @classmethod
    async def generate_chemical_formula_image(
        cls,
        formula: str,
        drug_name: str
    ) -> Optional[str]:
        """
        Generate an image of a chemical formula/molecular structure.

        Args:
            formula: Chemical formula (e.g., "C9H8O4")
            drug_name: Name of the drug

        Returns:
            URL of generated image, or None if generation failed
        """
        if not FREEPIK_API_KEY:
            return None

        prompt = (
            f"Molecular structure diagram of {drug_name} "
            f"with chemical formula {formula}, "
            f"2D chemical structure representation, "
            f"clear bond lines, atoms labeled, scientific diagram style, "
            f"white background, professional chemistry illustration"
        )

        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                response = await client.post(
                    FREEPIK_API_URL,
                    headers=cls._get_headers(),
                    json={
                        "prompt": prompt,
                        "aspect_ratio": "square_1_1",
                        "model": "realism",
                        "filter_nsfw": True
                    }
                )

                if response.status_code not in [200, 202]:
                    logger.error(f"Freepik API error: {response.status_code}")
                    return None

                data = response.json()
                status = data.get("data", {}).get("status", "")
                
                if status == "COMPLETED":
                    generated = data.get("data", {}).get("generated", [])
                    if generated and len(generated) > 0:
                        return generated[0].get("url")
                    return None
                elif status == "IN_PROGRESS":
                    task_id = data.get("data", {}).get("task_id")
                    if task_id:
                        return await cls._poll_task_status(task_id, client)
                
                return None

        except Exception as e:
            logger.error(f"Error generating formula image: {e}")
            return None


# Export singleton-style function
async def generate_reaction_image(
    drug1: str,
    drug2: str,
    drug1_formula: str = "",
    drug2_formula: str = "",
    mechanism: Optional[str] = None
) -> Optional[str]:
    """Generate a chemical reaction image for drug interaction."""
    return await FreepikService.generate_reaction_image(drug1, drug2, drug1_formula, drug2_formula, mechanism)


async def generate_chemical_formula_image(
    formula: str,
    drug_name: str
) -> Optional[str]:
    """Generate an image of a chemical formula/molecular structure."""
    return await FreepikService.generate_chemical_formula_image(formula, drug_name)
